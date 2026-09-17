import UIKit
import WebKit
import Capacitor
import Speech
import AVFoundation

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

final class XuechengBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let speechHandlerName = "xuechengSpeech"
    private let audioEngine = AVAudioEngine()
    private var observers: [NSObjectProtocol] = []
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechRecognizer: SFSpeechRecognizer?
    private var speechTimeout: DispatchWorkItem?
    private var activeSpeechSession: UUID?
    private var pendingSpeechStart: UUID?
    private var audioTapInstalled = false
    private lazy var speechMessageProxy = WeakScriptMessageHandler(delegate: self)

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let nativeShellScript = """
        window.__XUECHENG_NATIVE_SHELL__ = true;
        document.documentElement && document.documentElement.classList.add('native-shell');
        """
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: nativeShellScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController.removeScriptMessageHandler(forName: speechHandlerName)
        configuration.userContentController.add(speechMessageProxy, name: speechHandlerName)
        return configuration
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let center = NotificationCenter.default
        observers = [
            center.addObserver(
                forName: UIResponder.keyboardWillChangeFrameNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                self?.forwardKeyboardFrame(notification)
            },
            center.addObserver(
                forName: UIResponder.keyboardWillHideNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                self?.forwardKeyboardFrame(notification)
            },
            center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.cancelSpeech(emitEvent: true)
            }
        ]
    }

    deinit {
        let center = NotificationCenter.default
        observers.forEach(center.removeObserver)
        speechTimeout?.cancel()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: speechHandlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == speechHandlerName,
              let body = message.body as? [String: Any],
              let command = body["command"] as? String else {
            return
        }

        switch command {
        case "start":
            let allowCloud = body["allowCloud"] as? Bool ?? false
            let locale = body["locale"] as? String ?? "zh-CN"
            cancelSpeech(emitEvent: false)
            let pendingStart = UUID()
            pendingSpeechStart = pendingStart
            requestSpeechPermissions { [weak self] granted in
                guard let self else { return }
                guard self.pendingSpeechStart == pendingStart else { return }
                self.pendingSpeechStart = nil
                guard granted else {
                    self.emitSpeechEvent(state: "permission-denied", message: "Speech or microphone permission was denied")
                    return
                }
                self.startSpeechRecognition(locale: locale, allowCloud: allowCloud)
            }
        case "stop":
            stopSpeechRecognition()
        case "cancel":
            cancelSpeech(emitEvent: true)
        default:
            emitSpeechEvent(state: "failure", message: "Unknown speech command")
        }
    }

    private func requestSpeechPermissions(completion: @escaping (Bool) -> Void) {
        let requestMicrophone: (@escaping (Bool) -> Void) -> Void = { callback in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async { callback(granted) }
            }
        }

        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            requestMicrophone(completion)
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { status in
                DispatchQueue.main.async {
                    guard status == .authorized else {
                        completion(false)
                        return
                    }
                    requestMicrophone(completion)
                }
            }
        default:
            completion(false)
        }
    }

    private func startSpeechRecognition(locale: String, allowCloud: Bool) {
        cancelSpeech(emitEvent: false)
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)), recognizer.isAvailable else {
            emitSpeechEvent(state: "failure", message: "Speech recognition is unavailable")
            return
        }

        if !recognizer.supportsOnDeviceRecognition && !allowCloud {
            emitSpeechEvent(state: "cloud-consent-required")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = false
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        request.taskHint = .dictation

        let session = UUID()
        activeSpeechSession = session
        speechRecognizer = recognizer
        recognitionRequest = request

        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: [])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0 else {
                finishSpeechFailure(session: session, message: "Microphone input is unavailable")
                return
            }
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak request] buffer, _ in
                request?.append(buffer)
            }
            audioTapInstalled = true
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            finishSpeechFailure(session: session, message: "Unable to start audio capture")
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, self.activeSpeechSession == session else { return }
                if let result, result.isFinal {
                    let transcript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !transcript.isEmpty else {
                        self.finishSpeechFailure(session: session, message: "No speech was recognized")
                        return
                    }
                    self.finishSpeechSuccess(session: session, transcript: transcript)
                } else if let error {
                    self.finishSpeechFailure(session: session, message: error.localizedDescription)
                }
            }
        }
        emitSpeechEvent(state: "recording")
    }

    private func stopSpeechRecognition() {
        guard let session = activeSpeechSession else {
            if pendingSpeechStart != nil {
                pendingSpeechStart = nil
                emitSpeechEvent(state: "cancelled")
            }
            return
        }
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        removeAudioTapIfNeeded()
        recognitionRequest?.endAudio()
        emitSpeechEvent(state: "recognizing")

        speechTimeout?.cancel()
        let timeout = DispatchWorkItem { [weak self] in
            self?.finishSpeechFailure(session: session, message: "Speech recognition timed out")
        }
        speechTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: timeout)
    }

    private func finishSpeechSuccess(session: UUID, transcript: String) {
        guard activeSpeechSession == session else { return }
        cleanupSpeechSession()
        emitSpeechEvent(state: "success", transcript: transcript)
    }

    private func finishSpeechFailure(session: UUID, message: String) {
        guard activeSpeechSession == session else { return }
        cleanupSpeechSession()
        emitSpeechEvent(state: "failure", message: message)
    }

    private func cancelSpeech(emitEvent: Bool) {
        let hadActiveSession = activeSpeechSession != nil || pendingSpeechStart != nil
        pendingSpeechStart = nil
        cleanupSpeechSession()
        if emitEvent && hadActiveSession {
            emitSpeechEvent(state: "cancelled")
        }
    }

    private func cleanupSpeechSession() {
        speechTimeout?.cancel()
        speechTimeout = nil
        activeSpeechSession = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        removeAudioTapIfNeeded()
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        speechRecognizer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func removeAudioTapIfNeeded() {
        guard audioTapInstalled else { return }
        audioEngine.inputNode.removeTap(onBus: 0)
        audioTapInstalled = false
    }

    private func emitSpeechEvent(state: String, transcript: String? = nil, message: String? = nil) {
        var payload: [String: String] = ["state": state]
        if let transcript { payload["transcript"] = transcript }
        if let message { payload["message"] = message }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        let script = "window.dispatchEvent(new CustomEvent('xuecheng:speech',{detail:\(json)}));"
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }

    private func forwardKeyboardFrame(_ notification: Notification) {
        guard let webView,
              let frameValue = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else {
            return
        }

        let screenFrame = frameValue.cgRectValue
        let visible = screenFrame.minY < UIScreen.main.bounds.height - 1
        let frameInView = view.convert(screenFrame, from: nil)
        let inset = visible ? max(0, view.bounds.intersection(frameInView).height) : 0
        let visibleLiteral = visible ? "true" : "false"
        let payload = "{visible:\(visibleLiteral),inset:\(Int(inset.rounded()))}"
        let script = "window.dispatchEvent(new CustomEvent('xuecheng:native-keyboard',{detail:\(payload)}));"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}

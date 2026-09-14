import UIKit
import Capacitor

final class XuechengBridgeViewController: CAPBridgeViewController {
    private var keyboardObservers: [NSObjectProtocol] = []

    override func capacitorDidLoad() {
        bridge?.injectScriptBeforeLoad?(path: "native-bootstrap.js")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let center = NotificationCenter.default
        keyboardObservers = [
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
            }
        ]
    }

    deinit {
        let center = NotificationCenter.default
        keyboardObservers.forEach(center.removeObserver)
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

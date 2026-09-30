import SwiftUI

struct SplashView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ambientAppeared = false
    @State private var markAppeared = false
    @State private var wordmarkAppeared = false
    @State private var latinAppeared = false
    @State private var taglineAppeared = false

    var body: some View {
        ZStack {
            XuechengTheme.canvas(scheme)
            AmbientBackground(isSplash: true)
                .opacity(ambientAppeared ? 1 : 0)
                .animation(reduceMotion ? nil : XuechengMotion.splashAmbientReveal, value: ambientAppeared)

            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    Image("BrandMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: XuechengTheme.splashMarkSize, height: XuechengTheme.splashMarkSize)
                        .clipShape(RoundedRectangle(cornerRadius: XuechengTheme.splashMarkRadius, style: .continuous))
                        .background {
                            RoundedRectangle(cornerRadius: XuechengTheme.splashMarkRadius, style: .continuous)
                                .fill(XuechengTheme.graphite(scheme).opacity(scheme == .dark ? 0.45 : 0.16))
                                .blur(radius: 23)
                                .offset(y: 12)
                        }
                        .shadowToken(.large, scheme: scheme)
                        .opacity(markAppeared ? 1 : 0)
                        .scaleEffect(reduceMotion || markAppeared ? 1 : 0.92)
                        .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: markAppeared)

                    Text("学程")
                        .font(XuechengTypography.splashWordmark.font)
                        .tracking(XuechengTypography.splashWordmark.letterSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                        .padding(.top, 27)
                        .opacity(wordmarkAppeared ? 1 : 0)
                        .offset(y: reduceMotion || wordmarkAppeared ? 0 : 7)
                        .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: wordmarkAppeared)

                    Text("XUECHENG")
                        .font(XuechengTypography.brandLatin.font)
                        .tracking(XuechengTypography.brandLatin.letterSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        .padding(.top, 10)
                        .opacity(latinAppeared ? 1 : 0)
                        .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: latinAppeared)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .offset(y: -8)
                HStack(spacing: 13) {
                    Rectangle().fill(XuechengTheme.secondaryText(scheme).opacity(0.42)).frame(width: 18, height: 1)
                    Text("让学习拥有方向")
                        .font(XuechengTypography.splashTagline.font)
                        .tracking(XuechengTypography.splashTagline.letterSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    Rectangle().fill(XuechengTheme.secondaryText(scheme).opacity(0.42)).frame(width: 18, height: 1)
                }
                .padding(.bottom, XuechengTheme.splashCaptionBottomInset)
                .opacity(taglineAppeared ? 1 : 0)
                .offset(y: reduceMotion || taglineAppeared ? 0 : 5)
                .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: taglineAppeared)
            }
        }
        .task {
            guard !ambientAppeared else { return }
            if reduceMotion {
                ambientAppeared = true
                markAppeared = true
                wordmarkAppeared = true
                latinAppeared = true
                taglineAppeared = true
                return
            }

            withAnimation(XuechengMotion.splashAmbientReveal) { ambientAppeared = true }
            try? await Task.sleep(nanoseconds: XuechengMotion.splashStaggerMilliseconds * 1_000_000)
            withAnimation(XuechengMotion.standardTransition) { markAppeared = true }
            try? await Task.sleep(nanoseconds: XuechengMotion.splashStaggerMilliseconds * 1_000_000)
            withAnimation(XuechengMotion.standardTransition) { wordmarkAppeared = true }
            try? await Task.sleep(nanoseconds: XuechengMotion.splashStaggerMilliseconds * 1_000_000)
            withAnimation(XuechengMotion.standardTransition) { latinAppeared = true }
            try? await Task.sleep(nanoseconds: XuechengMotion.splashStaggerMilliseconds * 1_000_000)
            withAnimation(XuechengMotion.standardTransition) { taglineAppeared = true }
        }
        .accessibilityElement(children: .combine)
    }
}

private extension View {
    func shadowToken(_ level: XuechengTheme.ShadowLevel, scheme: ColorScheme) -> some View {
        let token = XuechengTheme.shadow(level, scheme: scheme)
        return shadow(color: token.color, radius: token.radius, x: token.x, y: token.y)
    }
}

#Preview("Splash · Light") {
    SplashView()
        .preferredColorScheme(.light)
}

#Preview("Splash · Dark") {
    SplashView()
        .preferredColorScheme(.dark)
}

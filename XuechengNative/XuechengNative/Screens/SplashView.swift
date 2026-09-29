import SwiftUI

struct SplashView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            AmbientBackground(isSplash: true)

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

                    Text("学程")
                        .font(XuechengTypography.splashWordmark.font)
                        .tracking(XuechengTypography.splashWordmark.letterSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                        .padding(.top, 27)

                    Text("XUECHENG")
                        .font(XuechengTypography.brandLatin.font)
                        .tracking(XuechengTypography.brandLatin.letterSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        .padding(.top, 10)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .offset(y: -8)
                .opacity(appeared ? 1 : 0)
                .scaleEffect(appeared ? 1 : 0.96)
                .blur(radius: appeared ? 0 : 3)

                HStack(spacing: 13) {
                    Rectangle().fill(XuechengTheme.secondaryText(scheme).opacity(0.42)).frame(width: 18, height: 1)
                    Text("让学习拥有方向")
                        .font(XuechengTypography.splashTagline.font)
                        .tracking(XuechengTypography.splashTagline.letterSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    Rectangle().fill(XuechengTheme.secondaryText(scheme).opacity(0.42)).frame(width: 18, height: 1)
                }
                .padding(.bottom, XuechengTheme.splashCaptionBottomInset)
                .opacity(appeared ? 1 : 0)
            }
        }
        .onAppear {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.55)) {
                appeared = true
            }
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

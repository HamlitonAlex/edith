import SwiftUI

struct SplashView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            AmbientBackground()

            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    Image("BrandMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 116, height: 116)
                        .clipShape(RoundedRectangle(cornerRadius: 31, style: .continuous))
                        .shadowToken(.large, scheme: scheme)

                    Text("学程")
                        .font(XuechengTheme.font(.wordmark))
                        .tracking(5.2)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                        .padding(.top, 27)

                    Text("XUECHENG")
                        .font(XuechengTheme.font(.brandMeta))
                        .tracking(3.8)
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
                        .font(XuechengTheme.font(.tagline))
                        .tracking(1.8)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    Rectangle().fill(XuechengTheme.secondaryText(scheme).opacity(0.42)).frame(width: 18, height: 1)
                }
                .padding(.bottom, 72)
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

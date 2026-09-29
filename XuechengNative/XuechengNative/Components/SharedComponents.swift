import SwiftUI

struct XuechengIconButton: View {
    @Environment(\.colorScheme) private var scheme
    let symbol: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .regular, design: .default))
                .foregroundStyle(XuechengTheme.primaryText(scheme))
                .frame(width: 42, height: 42)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(XuechengTheme.border(scheme), lineWidth: 0.7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

struct SectionHeader: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(XuechengTypography.sectionTitle.font)
                .foregroundStyle(XuechengTheme.primaryText(scheme))
            Spacer(minLength: XuechengTheme.space8)
            if let detail {
                Text(detail)
                    .font(XuechengTypography.caption.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
            }
        }
    }
}

struct AIMessageSurface<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        FrostedSurface(radius: XuechengTheme.radius24) { content }
    }
}

struct UserMessageSurface<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        NormalSurface(radius: XuechengTheme.radius20) { content }
    }
}

struct CompanionPresence: View {
    @Environment(\.colorScheme) private var scheme
    var size: CGFloat = 82

    private var coreSize: CGFloat { size * 0.585 }

    var body: some View {
        ZStack {
            Circle()
                .fill(XuechengTheme.mist(scheme).opacity(scheme == .dark ? 0.28 : 0.78))
                .frame(width: size, height: size)
                .blur(radius: size * 0.18)

            Circle()
                .fill(
                    LinearGradient(
                        colors: [XuechengTheme.textSecondaryLight.opacity(0.78), XuechengTheme.charcoal(scheme)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: coreSize, height: coreSize)
                .shadow(color: XuechengTheme.shadow(.medium, scheme: scheme).color, radius: 12, y: 5)
                .overlay {
                    Image(systemName: "sparkle")
                        .font(.system(size: coreSize * 0.36, weight: .regular))
                        .foregroundStyle(XuechengTheme.onGraphite(scheme))
                }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("小程")
    }
}

struct ChatInput: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var text: String
    var onAdd: () -> Void = {}
    var onVoice: () -> Void = {}
    var onSend: () -> Void = {}

    private var shadow: XuechengTheme.ShadowToken {
        XuechengTheme.shadow(.medium, scheme: scheme)
    }

    var body: some View {
        HStack(spacing: XuechengTheme.space12) {
            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .regular))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("更多输入方式")

            TextField("和小程聊聊", text: $text, axis: .vertical)
                .lineLimit(1...4)
                .font(XuechengTypography.body.font)
                .accessibilityLabel("消息内容")

            Button(action: text.isEmpty ? onVoice : onSend) {
                Image(systemName: text.isEmpty ? "mic" : "arrow.up")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(text.isEmpty ? XuechengTheme.secondaryText(scheme) : XuechengTheme.onGraphite(scheme))
                    .frame(width: 44, height: 44)
                    .background(text.isEmpty ? Color.clear : XuechengTheme.graphite(scheme), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(text.isEmpty ? "语音输入" : "发送")
        }
        .foregroundStyle(XuechengTheme.primaryText(scheme))
        .padding(.horizontal, 6)
        .frame(minHeight: 58)
        .background {
            RoundedRectangle(cornerRadius: XuechengTheme.controlRadius, style: .continuous)
                .fill(XuechengTheme.Materials.floating)
                .overlay {
                    RoundedRectangle(cornerRadius: XuechengTheme.controlRadius, style: .continuous)
                        .fill(XuechengTheme.background(.floating, scheme: scheme))
                }
        }
        .overlay(RoundedRectangle(cornerRadius: XuechengTheme.controlRadius, style: .continuous).strokeBorder(XuechengTheme.glassEdge(scheme), lineWidth: 0.7))
        .shadow(color: shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
    }
}

struct NativeHeader: View {
    @Environment(\.colorScheme) private var scheme
    let title: String

    var body: some View {
        HStack(spacing: XuechengTheme.space12) {
            Image("BrandMark")
                .resizable()
                .scaledToFit()
                .frame(width: 30, height: 30)
                .clipShape(RoundedRectangle(cornerRadius: XuechengTheme.radius12, style: .continuous))
                .accessibilityHidden(true)

            Text(title)
                .font(XuechengTypography.caption.font)
                .foregroundStyle(XuechengTheme.primaryText(scheme))

            Spacer()

            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                .frame(width: 36, height: 36)
                .background(XuechengTheme.mist(scheme), in: Circle())
                .accessibilityLabel("个人资料")
        }
        .padding(.horizontal, XuechengTheme.pagePadding)
        .frame(height: 42)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
        .overlay(alignment: .bottom) { Rectangle().fill(XuechengTheme.border(scheme)).frame(height: 0.5) }
    }
}

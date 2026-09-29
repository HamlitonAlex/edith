import SwiftUI

struct XuechengGlassSurface<Content: View>: View {
    let level: SurfaceLevel
    let radius: CGFloat
    let content: Content

    init(level: SurfaceLevel = .frosted, radius: CGFloat = XuechengTheme.radius28, @ViewBuilder content: () -> Content) {
        self.level = level
        self.radius = radius
        self.content = content()
    }

    var body: some View { GlassCard(level: level, radius: radius) { content } }
}

struct XuechengCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        XuechengGlassSurface(level: .normal, radius: XuechengTheme.radius24) { content }
    }
}

struct XuechengButton: View {
    enum Variant { case primary, secondary, quiet }

    let title: String
    let variant: Variant
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Group {
            switch variant {
            case .primary:
                button.buttonStyle(PrimaryButtonStyle())
            case .secondary:
                button.buttonStyle(SecondaryButtonStyle())
            case .quiet:
                button.buttonStyle(.plain)
            }
        }
        .disabled(isDisabled || isLoading)
    }

    private var button: some View {
        Button(action: action) {
            HStack(spacing: XuechengTheme.space8) {
                if isLoading { ProgressView().controlSize(.small) }
                Text(title)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct XuechengSection<Content: View>: View {
    let title: String
    var detail: String? = nil
    let spacing: CGFloat
    let content: Content

    init(_ title: String, detail: String? = nil, spacing: CGFloat = XuechengTheme.space12, @ViewBuilder content: () -> Content) {
        self.title = title
        self.detail = detail
        self.spacing = spacing
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            SectionHeader(title: title, detail: detail)
            content
        }
    }
}

struct EvidenceCard: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let summary: String

    var body: some View {
        VStack(alignment: .leading, spacing: XuechengTheme.space8) {
            Text(title)
                .font(XuechengTypography.metadata.font)
                .foregroundStyle(XuechengTheme.secondaryText(scheme))
            Text(summary)
                .font(XuechengTypography.body.font)
                .lineSpacing(XuechengTypography.body.lineSpacing)
                .foregroundStyle(XuechengTheme.primaryText(scheme))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CapabilityCard: View {
    @Environment(\.colorScheme) private var scheme
    let capability: Capability

    var body: some View {
        XuechengGlassSurface(level: .frosted, radius: XuechengTheme.radius20) {
            HStack(alignment: .top, spacing: XuechengTheme.space16) {
                Circle()
                    .fill(XuechengTheme.graphite(scheme).opacity(capability.state == .stable ? 0.75 : 0.2))
                    .frame(width: XuechengTheme.space8, height: XuechengTheme.space8)
                    .padding(.top, XuechengTheme.pathMarkerTopInset)
                VStack(alignment: .leading, spacing: XuechengTheme.space8) {
                    Text(capability.domain)
                        .font(XuechengTypography.metadata.font)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    Text(capability.title)
                        .font(XuechengTypography.capabilityTitle.font)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                    Text(capability.state.title)
                        .font(XuechengTypography.caption.font)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                }
                Spacer(minLength: XuechengTheme.space8)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    .padding(.top, XuechengTheme.space12)
            }
            .padding(XuechengTheme.space16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct NextStepCard<Action: View>: View {
    @Environment(\.colorScheme) private var scheme
    let step: NextStep
    let capabilityTitle: String
    let action: Action

    init(step: NextStep, capabilityTitle: String, @ViewBuilder action: () -> Action) {
        self.step = step
        self.capabilityTitle = capabilityTitle
        self.action = action()
    }

    var body: some View {
        XuechengGlassSurface(level: .floating, radius: XuechengTheme.nextStepRadius) {
            VStack(alignment: .leading, spacing: 0) {
                Text("下一步")
                    .font(XuechengTypography.metadata.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                Text(step.title)
                    .font(XuechengTypography.pageTitle.font)
                    .lineSpacing(XuechengTypography.pageTitle.lineSpacing)
                    .tracking(XuechengTypography.pageTitle.letterSpacing)
                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                    .padding(.top, XuechengTheme.nextStepTitleGap)
                Text("能力 · \(capabilityTitle)")
                    .font(XuechengTypography.metadata.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    .padding(.top, XuechengTheme.space12)
                Text(step.reason)
                    .font(XuechengTypography.secondaryBody.font)
                    .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, XuechengTheme.nextStepReasonGap)
                Text("预计 \(step.estimatedMinutes) 分钟")
                    .font(XuechengTypography.metadata.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    .padding(.top, XuechengTheme.nextStepDurationGap)
                action.padding(.top, XuechengTheme.nextStepActionGap)
            }
            .padding(.horizontal, XuechengTheme.nextStepHorizontalInset)
            .padding(.top, XuechengTheme.nextStepTopInset)
            .padding(.bottom, XuechengTheme.nextStepBottomInset)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: XuechengTheme.nextStepRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: XuechengTheme.nextStepGradient(scheme),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
        }
    }
}

struct SessionResultCard: View {
    @Environment(\.colorScheme) private var scheme
    let result: SessionResult

    var body: some View {
        XuechengGlassSurface(level: .frosted, radius: XuechengTheme.radius20) {
            VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                Text("能力状态")
                    .font(XuechengTypography.metadata.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                Text("\(result.previousState.title) → \(result.currentState.title)")
                    .font(XuechengTypography.capabilityTitle.font)
                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                Text(result.stateReason)
                    .font(XuechengTypography.secondaryBody.font)
                    .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
            }
            .padding(XuechengTheme.space24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ConfirmationSurface: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let message: String
    let confirmTitle: String
    let onConfirm: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        XuechengGlassSurface(level: .floating) {
            VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                Text(title)
                    .font(XuechengTypography.sectionTitle.font)
                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                Text(message)
                    .font(XuechengTypography.body.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                HStack(spacing: XuechengTheme.space12) {
                    XuechengButton(title: "暂不", variant: .quiet, action: onDismiss)
                    XuechengButton(title: confirmTitle, variant: .primary, action: onConfirm)
                }
            }
            .padding(XuechengTheme.space24)
        }
    }
}

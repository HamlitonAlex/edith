import SwiftUI

struct CapabilityDetailView: View {
    @Environment(\.colorScheme) private var scheme
    let capabilityID: String

    private var capability: Capability? {
        PreviewFixtures.capability(id: capabilityID)
    }

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                if let capability {
                    VStack(alignment: .leading, spacing: XuechengTheme.space24) {
                        VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                            Text(capability.domain)
                                .font(XuechengTypography.metadata.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text(capability.title)
                                .font(XuechengTypography.display.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("当前状态 · \(capability.state.title)")
                                .font(XuechengTypography.secondaryBody.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }

                        EvidenceCard(title: "为什么是这个状态", summary: capability.stateReason)
                        EvidenceCard(title: "前置能力", summary: capability.prerequisites.isEmpty ? "这是当前路径的基础能力。" : capability.prerequisites.joined(separator: "、"))
                        EvidenceCard(title: "最近证据", summary: PreviewFixtures.latestEvidence(for: capability))
                        EvidenceCard(title: "最近练习", summary: PreviewFixtures.latestPractice(for: capability))

                        FrostedSurface(radius: XuechengTheme.radius20) {
                            VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                                Text("下一项验证")
                                    .font(XuechengTypography.metadata.font)
                                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
                                Text(capability.nextVerification)
                                    .font(XuechengTypography.body.font)
                                    .lineSpacing(XuechengTypography.body.lineSpacing)
                                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                            }
                            .padding(XuechengTheme.space24)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, XuechengTheme.pagePadding)
                    .padding(.top, XuechengTheme.space32)
                    .padding(.bottom, XuechengTheme.space32)
                } else {
                    ContentUnavailableView("未找到这项能力", systemImage: "questionmark.circle")
                }
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("能力详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }

}

#Preview("能力详情 · 浅色") {
    NavigationStack { CapabilityDetailView(capabilityID: "recursion") }
        .preferredColorScheme(.light)
}

#Preview("能力详情 · 深色") {
    NavigationStack { CapabilityDetailView(capabilityID: "recursion") }
        .preferredColorScheme(.dark)
}

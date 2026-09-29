import SwiftUI

struct ScheduleView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: XuechengTheme.space24) {
                    Text("今天的安排")
                        .font(XuechengTypography.pageTitle.font)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                    ForEach(PreviewFixtures.scheduleEntries) { entry in
                        scheduleRow(entry)
                    }
                    Text("待确认的建议不会自动变成正式日程。")
                        .font(XuechengTypography.secondaryBody.font)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space32)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("日程")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }

    private func scheduleRow(_ entry: ScheduleEntry) -> some View {
        HStack(alignment: .top, spacing: XuechengTheme.space16) {
            Text(entry.timeLabel)
                .font(XuechengTypography.metadata.font)
                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                .frame(width: 48, alignment: .leading)
            VStack(alignment: .leading, spacing: XuechengTheme.space8) {
                Text(entry.title)
                    .font(XuechengTypography.body.font)
                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                Text(entry.statusTitle)
                    .font(XuechengTypography.caption.font)
                    .foregroundStyle(XuechengTheme.secondaryText(scheme))
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, XuechengTheme.space16)
        .overlay(alignment: .bottom) {
            Rectangle().fill(XuechengTheme.border(scheme)).frame(height: 0.5)
        }
    }
}

#Preview("日程 · 浅色") {
    NavigationStack { ScheduleView() }
        .preferredColorScheme(.light)
}

#Preview("日程 · 深色") {
    NavigationStack { ScheduleView() }
        .preferredColorScheme(.dark)
}

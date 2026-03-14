import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Live Activity Attributes

struct SmartMedeoWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var temperature: Int
        var conditionCode: String
        var conditionText: String
        var tempMax: Int?
        var tempMin: Int?
        var precipProb: Int
    }

    var locationName: String
}

// MARK: - Live Activity Widget

struct SmartMedeoWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SmartMedeoWidgetAttributes.self) { context in
            // Lock screen / banner
            HStack(spacing: 16) {
                // Icona e temperatura
                HStack(spacing: 8) {
                    Image(systemName: WeatherIconMapper.sfSymbol(for: context.state.conditionCode))
                        .font(.system(size: 28))
                        .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: context.state.conditionCode)))
                        .symbolRenderingMode(.hierarchical)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(context.state.temperature)°")
                            .font(.system(size: 28, weight: .light))
                            .foregroundStyle(.white)

                        Text(context.state.conditionText)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Dettagli
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 9))
                        Text(context.attributes.locationName)
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white.opacity(0.8))

                    HStack(spacing: 8) {
                        if let max = context.state.tempMax, let min = context.state.tempMin {
                            Label("\(max)°", systemImage: "arrow.up")
                            Label("\(min)°", systemImage: "arrow.down")
                        }
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))

                    if context.state.precipProb > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "drop.fill")
                                .font(.system(size: 9))
                            Text("\(context.state.precipProb)%")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color(hex: "74B9FF"))
                    }
                }
            }
            .padding(16)
            .activityBackgroundTint(Color(hex: "1A237E"))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: WeatherIconMapper.sfSymbol(for: context.state.conditionCode))
                            .font(.system(size: 22))
                            .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: context.state.conditionCode)))
                            .symbolRenderingMode(.hierarchical)
                        Text("\(context.state.temperature)°")
                            .font(.system(size: 24, weight: .light))
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(context.attributes.locationName)
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                        Text(context.state.conditionText)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 16) {
                        if let max = context.state.tempMax, let min = context.state.tempMin {
                            Label("Max \(max)°", systemImage: "arrow.up")
                            Label("Min \(min)°", systemImage: "arrow.down")
                        }
                        if context.state.precipProb > 0 {
                            Label("\(context.state.precipProb)%", systemImage: "drop.fill")
                                .foregroundStyle(.cyan)
                        }
                    }
                    .font(.system(size: 12, weight: .medium))
                }
            } compactLeading: {
                Image(systemName: WeatherIconMapper.sfSymbol(for: context.state.conditionCode))
                    .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: context.state.conditionCode)))
                    .symbolRenderingMode(.hierarchical)
            } compactTrailing: {
                Text("\(context.state.temperature)°")
                    .font(.system(size: 14, weight: .semibold))
            } minimal: {
                Image(systemName: WeatherIconMapper.sfSymbol(for: context.state.conditionCode))
                    .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: context.state.conditionCode)))
                    .symbolRenderingMode(.hierarchical)
            }
            .widgetURL(URL(string: "smartmeteo://dashboard"))
        }
    }
}

// MARK: - Previews

extension SmartMedeoWidgetAttributes {
    fileprivate static var preview: SmartMedeoWidgetAttributes {
        SmartMedeoWidgetAttributes(locationName: "Roma")
    }
}

extension SmartMedeoWidgetAttributes.ContentState {
    fileprivate static var sunny: SmartMedeoWidgetAttributes.ContentState {
        SmartMedeoWidgetAttributes.ContentState(
            temperature: 22,
            conditionCode: "0",
            conditionText: "Sereno",
            tempMax: 25,
            tempMin: 16,
            precipProb: 0
        )
    }

    fileprivate static var rainy: SmartMedeoWidgetAttributes.ContentState {
        SmartMedeoWidgetAttributes.ContentState(
            temperature: 14,
            conditionCode: "61",
            conditionText: "Pioggia",
            tempMax: 16,
            tempMin: 11,
            precipProb: 80
        )
    }
}

#Preview("Notification", as: .content, using: SmartMedeoWidgetAttributes.preview) {
    SmartMedeoWidgetLiveActivity()
} contentStates: {
    SmartMedeoWidgetAttributes.ContentState.sunny
    SmartMedeoWidgetAttributes.ContentState.rainy
}

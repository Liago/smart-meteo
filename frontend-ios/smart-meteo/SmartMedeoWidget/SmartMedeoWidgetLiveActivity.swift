//
//  SmartMedeoWidgetLiveActivity.swift
//  SmartMedeoWidget
//
//  Created by Andrea Zampierolo on 10/03/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct SmartMedeoWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct SmartMedeoWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SmartMedeoWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension SmartMedeoWidgetAttributes {
    fileprivate static var preview: SmartMedeoWidgetAttributes {
        SmartMedeoWidgetAttributes(name: "World")
    }
}

extension SmartMedeoWidgetAttributes.ContentState {
    fileprivate static var smiley: SmartMedeoWidgetAttributes.ContentState {
        SmartMedeoWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: SmartMedeoWidgetAttributes.ContentState {
         SmartMedeoWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: SmartMedeoWidgetAttributes.preview) {
   SmartMedeoWidgetLiveActivity()
} contentStates: {
    SmartMedeoWidgetAttributes.ContentState.smiley
    SmartMedeoWidgetAttributes.ContentState.starEyes
}

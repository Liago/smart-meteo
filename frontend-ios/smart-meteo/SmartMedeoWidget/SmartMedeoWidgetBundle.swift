//
//  SmartMedeoWidgetBundle.swift
//  SmartMedeoWidget
//
//  Created by Andrea Zampierolo on 10/03/26.
//

import WidgetKit
import SwiftUI

@main
struct SmartMedeoWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmartMedeoWidget()
        SmartMedeoWidgetControl()
        SmartMedeoWidgetLiveActivity()
    }
}

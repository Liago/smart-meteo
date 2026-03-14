import WidgetKit
import SwiftUI

@main
struct SmartMedeoWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmartMedeoWidget()           // Meteo attuale (small + medium)
        HourlyForecastWidget()       // Previsioni orarie (medium)
        WeeklyForecastWidget()       // Previsioni settimanali (medium + large)
        SmartMedeoWidgetLiveActivity()
    }
}

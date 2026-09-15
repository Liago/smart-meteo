import SwiftUI

extension Path {
    /// Prosegue il tracciato con una curva morbida che passa per i punti dati.
    ///
    /// Separata da `smoothCurve` perché chi disegna una **banda** ha bisogno
    /// che il bordo inferiore *continui* il poligono invece di aprirne uno
    /// nuovo: `Path.addPath` porta con sé il proprio `move(to:)` e spezzerebbe
    /// la figura in due sottotracciati aperti, che il riempimento renderebbe
    /// come due schegge invece che come una banda.
    mutating func appendSmoothCurve(through points: [CGPoint]) {
        guard points.count > 1 else { return }

        for i in 0..<(points.count - 1) {
            let p1 = points[i]
            let p2 = points[i + 1]
            let mid = CGPoint(x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2)
            let cp1 = CGPoint(x: (p1.x + mid.x) / 2, y: p1.y)
            let cp2 = CGPoint(x: (mid.x + p2.x) / 2, y: p2.y)

            addQuadCurve(to: mid, control: cp1)
            addQuadCurve(to: p2, control: cp2)
        }
    }

    /// Curva morbida che passa per i punti dati.
    ///
    /// Vive qui e non dentro una vista perché la usano la sparkline della
    /// dashboard, la curva del dettaglio orario e i due bordi della banda di
    /// incertezza: tre interpolazioni copiate si sarebbero disallineate al
    /// primo ritocco, e una banda che non segue la propria curva è peggio di
    /// nessuna banda.
    static func smoothCurve(through points: [CGPoint]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        path.appendSmoothCurve(through: points)
        return path
    }
}

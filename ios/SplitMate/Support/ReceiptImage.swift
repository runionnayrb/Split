import PDFKit
import SwiftUI
import VisionKit

enum ReceiptImage {
    /// Same treatment as the web app: longest side ≤ 1400px, JPEG quality 0.72.
    static func compressed(_ image: UIImage, maxSide: CGFloat = 1400) -> Data? {
        let size = image.size
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.72)
    }

    /// Loads an image file, or renders the first page of a PDF.
    static func load(from url: URL) -> UIImage? {
        if url.pathExtension.lowercased() == "pdf" {
            guard let page = PDFDocument(url: url)?.page(at: 0) else { return nil }
            let bounds = page.bounds(for: .mediaBox)
            let scale = 1400 / max(bounds.width, bounds.height)
            return page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)
        }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }
}

/// Apple's document camera: edge detection, auto-capture and perspective correction.
struct DocumentScanner: UIViewControllerRepresentable {
    let completion: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let vc = VNDocumentCameraViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let completion: (UIImage?) -> Void
        init(completion: @escaping (UIImage?) -> Void) { self.completion = completion }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                          didFinishWith scan: VNDocumentCameraScan) {
            completion(scan.pageCount > 0 ? scan.imageOfPage(at: 0) : nil)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            completion(nil)
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            completion(nil)
        }
    }
}

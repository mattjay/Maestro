// ViewHierarchyCollector.swift
// MaestroBridge
//
// Collects view controller hierarchy from the app.
// IMPORTANT: This package should NEVER ship to production.

#if canImport(UIKit)
import UIKit
#endif
import Foundation

/// Collects view and view controller hierarchy information
public final class ViewHierarchyCollector: @unchecked Sendable {
    /// Shared instance
    public static let shared = ViewHierarchyCollector()

    private init() {}

    /// Get the current view controller stack
    /// - Returns: Array of view controller class names from root to current
    public func getViewControllerStack() -> [String] {
        #if canImport(UIKit) && !os(watchOS)
        return DispatchQueue.main.sync {
            collectViewControllerStack()
        }
        #else
        return []
        #endif
    }

    /// Get the current (topmost) view controller name
    public func getCurrentViewController() -> String {
        #if canImport(UIKit) && !os(watchOS)
        return DispatchQueue.main.sync {
            findTopViewController()?.className ?? ""
        }
        #else
        return ""
        #endif
    }

    /// Get current route based on view controller hierarchy
    public func getCurrentRoute() -> RouteInfo {
        #if canImport(UIKit) && !os(watchOS)
        return DispatchQueue.main.sync {
            buildRouteInfo()
        }
        #else
        return RouteInfo(currentRoute: "")
        #endif
    }

    // MARK: - Private (UIKit-specific)

    #if canImport(UIKit) && !os(watchOS)

    private func collectViewControllerStack() -> [String] {
        var stack: [String] = []

        guard let rootVC = getRootViewController() else {
            return stack
        }

        collectControllers(from: rootVC, into: &stack)
        return stack
    }

    private func collectControllers(
        from viewController: UIViewController,
        into stack: inout [String]
    ) {
        stack.append(viewController.className)

        // Handle container view controllers
        if let nav = viewController as? UINavigationController {
            for vc in nav.viewControllers {
                collectControllers(from: vc, into: &stack)
            }
        } else if let tab = viewController as? UITabBarController {
            if let selected = tab.selectedViewController {
                collectControllers(from: selected, into: &stack)
            }
        } else if let split = viewController as? UISplitViewController {
            for vc in split.viewControllers {
                collectControllers(from: vc, into: &stack)
            }
        } else if let presented = viewController.presentedViewController {
            collectControllers(from: presented, into: &stack)
        }
    }

    private func findTopViewController() -> UIViewController? {
        guard var topVC = getRootViewController() else {
            return nil
        }

        while true {
            if let presented = topVC.presentedViewController {
                topVC = presented
            } else if let nav = topVC as? UINavigationController,
                      let visible = nav.visibleViewController {
                topVC = visible
            } else if let tab = topVC as? UITabBarController,
                      let selected = tab.selectedViewController {
                topVC = selected
            } else {
                break
            }
        }

        return topVC
    }

    private func getRootViewController() -> UIViewController? {
        // Try connected scenes first (iOS 13+)
        if #available(iOS 13.0, *) {
            for scene in UIApplication.shared.connectedScenes {
                if let windowScene = scene as? UIWindowScene {
                    for window in windowScene.windows {
                        if window.isKeyWindow {
                            return window.rootViewController
                        }
                    }
                }
            }
        }

        // Fallback for older iOS
        return UIApplication.shared.keyWindow?.rootViewController
    }

    private func buildRouteInfo() -> RouteInfo {
        guard let rootVC = getRootViewController() else {
            return RouteInfo(currentRoute: "")
        }

        var stack: [RouteEntry] = []
        var currentRoute = ""
        var canGoBack = false
        var presentedModally = false

        buildRouteStack(from: rootVC, stack: &stack)

        if let lastEntry = stack.last {
            currentRoute = lastEntry.route
        }

        // Check if we can go back
        if let topVC = findTopViewController() {
            if let nav = topVC.navigationController {
                canGoBack = nav.viewControllers.count > 1
            }
            presentedModally = topVC.presentingViewController != nil
        }

        return RouteInfo(
            currentRoute: currentRoute,
            stack: stack,
            canGoBack: canGoBack,
            presentedModally: presentedModally
        )
    }

    private func buildRouteStack(
        from viewController: UIViewController,
        stack: inout [RouteEntry]
    ) {
        let entry = RouteEntry(
            route: routeForViewController(viewController),
            title: viewController.title,
            viewController: viewController.className,
            timestamp: nil
        )

        // Handle container view controllers
        if let nav = viewController as? UINavigationController {
            for vc in nav.viewControllers {
                buildRouteStack(from: vc, stack: &stack)
            }
        } else if let tab = viewController as? UITabBarController {
            if let selected = tab.selectedViewController {
                buildRouteStack(from: selected, stack: &stack)
            }
        } else if let split = viewController as? UISplitViewController {
            for vc in split.viewControllers {
                buildRouteStack(from: vc, stack: &stack)
            }
        } else {
            stack.append(entry)
        }

        // Handle presented modals
        if let presented = viewController.presentedViewController {
            buildRouteStack(from: presented, stack: &stack)
        }
    }

    private func routeForViewController(_ vc: UIViewController) -> String {
        // Generate a route-like path from view controller
        // Apps can customize this by implementing a protocol
        if let routable = vc as? MaestroBridgeRoutable {
            return routable.maestroRoute
        }

        // Default: convert class name to route
        let name = vc.className
            .replacingOccurrences(of: "ViewController", with: "")
            .replacingOccurrences(of: "Controller", with: "")

        return "/" + name.lowercased()
    }

    #endif
}

// MARK: - UIViewController Extension

#if canImport(UIKit) && !os(watchOS)
import UIKit

extension UIViewController {
    var className: String {
        String(describing: type(of: self))
    }
}
#endif

// MARK: - Protocol for custom routes

/// Protocol for view controllers to provide custom route paths
public protocol MaestroBridgeRoutable {
    /// The route path for this view controller (e.g., "/settings/profile")
    var maestroRoute: String { get }
}

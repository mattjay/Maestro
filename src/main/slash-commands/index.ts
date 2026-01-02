/**
 * Slash Commands Module
 *
 * This module provides handlers for slash commands that are executed
 * by the AI agent or intercepted by Maestro.
 *
 * iOS commands (like /ios.snapshot, /ios.inspect, /ios.run_flow) are passed
 * to the AI agent which uses these handlers via IPC to execute the actual operations.
 */

// iOS Snapshot Command
export {
  executeSnapshotCommand,
  parseSnapshotArgs,
  snapshotCommandMetadata,
  type SnapshotCommandArgs,
  type SnapshotCommandResult,
} from './ios-snapshot';

// iOS Inspect Command
export {
  executeInspectCommand,
  parseInspectArgs,
  parseElementQuery,
  inspectCommandMetadata,
  type InspectCommandArgs,
  type InspectCommandResult,
} from './ios-inspect';

// iOS Run Flow Command
export {
  executeRunFlowCommand,
  parseRunFlowArgs,
  runFlowCommandMetadata,
  type RunFlowCommandArgs,
  type RunFlowCommandResult,
} from './ios-run-flow';

// iOS Tap Command
export {
  executeTapCommand,
  parseTapArgs,
  parseTarget,
  tapCommandMetadata,
  type TapCommandArgs,
  type TapCommandResult,
  type TapTarget,
  type TapTargetType,
} from './ios-tap';

// iOS Type Command
export {
  executeTypeCommand,
  parseTypeArgs,
  parseTypeTarget,
  typeCommandMetadata,
  type TypeCommandArgs,
  type TypeCommandResult,
  type TypeTarget,
  type TypeTargetType,
} from './ios-type';

// iOS Scroll Command
export {
  executeScrollCommand,
  parseScrollArgs,
  parseScrollTarget,
  parseDirection,
  scrollCommandMetadata,
  type ScrollCommandArgs,
  type ScrollCommandResult,
  type ScrollTarget,
  type ScrollTargetType,
  type ScrollDirection,
} from './ios-scroll';

// iOS Swipe Command
export {
  executeSwipeCommand,
  parseSwipeArgs,
  parseSwipeTarget,
  parseSwipeDirection,
  parseVelocity,
  swipeCommandMetadata,
  type SwipeCommandArgs,
  type SwipeCommandResult,
  type SwipeTarget,
  type SwipeTargetType,
  type SwipeDirection,
} from './ios-swipe';

// iOS Playbook Command
export {
  executePlaybookCommand,
  parsePlaybookArgs,
  playbookCommandMetadata,
  type PlaybookSubcommand,
  type PlaybookCommandArgs,
  type PlaybookCommandResult,
} from './ios-playbook';

// iOS Bridge Commands
export {
  executeBridgeStateCommand,
  parseBridgeStateArgs,
  bridgeStateCommandMetadata,
  executeBridgeRouteCommand,
  parseBridgeRouteArgs,
  bridgeRouteCommandMetadata,
  executeBridgeNetworkCommand,
  parseBridgeNetworkArgs,
  bridgeNetworkCommandMetadata,
  executeBridgeAnalyticsCommand,
  parseBridgeAnalyticsArgs,
  bridgeAnalyticsCommandMetadata,
  executeBridgeFlagsCommand,
  parseBridgeFlagsArgs,
  bridgeFlagsCommandMetadata,
  executeBridgeSetCommand,
  parseBridgeSetArgs,
  bridgeSetCommandMetadata,
  type BridgeStateCommandArgs,
  type BridgeRouteCommandArgs,
  type BridgeNetworkCommandArgs,
  type BridgeAnalyticsCommandArgs,
  type BridgeFlagsCommandArgs,
  type BridgeSetCommandArgs,
  type BridgeCommandResult,
} from './ios-bridge';

// iOS Baseline Command
export {
  executeBaselineCommand,
  parseBaselineArgs,
  baselineCommandMetadata,
  type BaselineSubcommand,
  type IgnoreRegionArg,
  type BaselineCommandArgs,
  type BaselineCommandResult,
} from './ios-baseline';

// iOS Diff Command
export {
  executeDiffCommand,
  parseDiffArgs,
  diffCommandMetadata,
  type DiffMode,
  type DiffCommandArgs,
  type DiffCommandResult,
  type SingleDiffResult,
  type FlowDiffResult,
} from './ios-diff';

// iOS Regression Command
export {
  executeRegressionCommand,
  parseRegressionArgs,
  regressionCommandMetadata,
  type RegressionMode,
  type RegressionCommandArgs,
  type RegressionCommandResult,
  type BaselineTestResult,
  type FlowTestResult,
  type RegressionTestResult,
} from './ios-regression';

// Command registry for all slash commands
export interface SlashCommandMetadata {
  command: string;
  description: string;
  usage: string;
  options: {
    name: string;
    description: string;
    valueHint: string | null;
  }[];
  examples: string[];
}

// Export command metadata for autocomplete
import { snapshotCommandMetadata } from './ios-snapshot';
import { inspectCommandMetadata } from './ios-inspect';
import { runFlowCommandMetadata } from './ios-run-flow';
import { tapCommandMetadata } from './ios-tap';
import { typeCommandMetadata } from './ios-type';
import { scrollCommandMetadata } from './ios-scroll';
import { swipeCommandMetadata } from './ios-swipe';
import { playbookCommandMetadata } from './ios-playbook';
import {
  bridgeStateCommandMetadata,
  bridgeRouteCommandMetadata,
  bridgeNetworkCommandMetadata,
  bridgeAnalyticsCommandMetadata,
  bridgeFlagsCommandMetadata,
  bridgeSetCommandMetadata,
} from './ios-bridge';
import { baselineCommandMetadata } from './ios-baseline';
import { diffCommandMetadata } from './ios-diff';
import { regressionCommandMetadata } from './ios-regression';

export const iosSlashCommandMetadata: SlashCommandMetadata[] = [
  snapshotCommandMetadata,
  inspectCommandMetadata,
  runFlowCommandMetadata,
  tapCommandMetadata,
  typeCommandMetadata,
  scrollCommandMetadata,
  swipeCommandMetadata,
  playbookCommandMetadata,
  bridgeStateCommandMetadata,
  bridgeRouteCommandMetadata,
  bridgeNetworkCommandMetadata,
  bridgeAnalyticsCommandMetadata,
  bridgeFlagsCommandMetadata,
  bridgeSetCommandMetadata,
  baselineCommandMetadata,
  diffCommandMetadata,
  regressionCommandMetadata,
];

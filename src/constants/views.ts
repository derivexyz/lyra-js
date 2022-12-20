import { OptionMarketViewer as OptionMarketViewerAvalon } from '../contracts/avalon/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain'

export type MarketParametersStructOutput =
  | OptionMarketViewer.MarketParametersStructOutput
  | OptionMarketViewerAvalon.MarketParametersStructOutput

export type MarketViewWithBoardsStructOutput =
  | OptionMarketViewer.MarketViewWithBoardsStructOutput
  | OptionMarketViewerAvalon.MarketViewWithBoardsStructOutput

export type BoardViewStructOutput =
  | OptionMarketViewer.BoardViewStructOutput
  | OptionMarketViewerAvalon.BoardViewStructOutput

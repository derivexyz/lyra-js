import { AvalonOptionMarketViewer as TAvalonOptionMarketViewer } from '../contracts/avalon/typechain'
import { OptionMarketViewer as NAvalonOptionMarketViewer } from '../contracts/avalon/typechain/AvalonOptionMarketViewer'
import { NewportOptionMarketViewer as TNewportOptionMarketViewer } from '../contracts/newport/typechain'
import { OptionMarketViewer as NNewportOptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'

export type OptionMarketViewer = TAvalonOptionMarketViewer | TNewportOptionMarketViewer

export type MarketParametersStructOutput =
  | NAvalonOptionMarketViewer.MarketParametersStructOutput
  | NNewportOptionMarketViewer.MarketParametersStructOutput

export type MarketViewWithBoardsStructOutput =
  | NAvalonOptionMarketViewer.MarketViewWithBoardsStructOutput
  | NNewportOptionMarketViewer.MarketViewStructOutput

export type BoardViewStructOutput =
  | NAvalonOptionMarketViewer.BoardViewStructOutput
  | NNewportOptionMarketViewer.BoardViewStructOutput

export type StrikeViewStructOutput =
  | NAvalonOptionMarketViewer.StrikeViewStructOutput
  | NNewportOptionMarketViewer.StrikeViewStructOutput

export type MarketStaticLiquidity = MarketViewWithBoardsStructOutput['liquidity']

export type MarketStaticNetGreeks = MarketViewWithBoardsStructOutput['globalNetGreeks']

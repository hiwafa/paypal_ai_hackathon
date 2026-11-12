import { colorSchemeDark, themeQuartz } from "ag-grid-community";

/**
 * AG Grid's Quartz theme, tuned to sit inside the office's frosted panels.
 * The header and the totals row are sticky and rows scroll beneath them, so
 * those two get opaque colours; everything else stays see-through.
 */
export const ledgerTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  browserColorScheme: "dark",
  backgroundColor: "transparent",
  foregroundColor: "#ececef",
  accentColor: "#e8c98e",
  borderColor: "rgb(255 255 255 / 0.07)",
  chromeBackgroundColor: "#131318",
  headerBackgroundColor: "#131318",
  headerTextColor: "rgb(255 255 255 / 0.5)",
  headerFontWeight: 500,
  headerHeight: 38,
  rowHeight: 52,
  fontFamily: "inherit",
  fontSize: 13,
  spacing: 6,
  cellHorizontalPadding: 12,
  oddRowBackgroundColor: "rgb(255 255 255 / 0.012)",
  rowHoverColor: "rgb(255 255 255 / 0.045)",
  rowBorder: { color: "rgb(255 255 255 / 0.05)" },
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  pinnedRowBorder: { color: "rgb(232 201 142 / 0.35)" },
  pinnedRowBackgroundColor: "#1b1a1c",
  valueChangeValueHighlightBackgroundColor: "rgb(232 201 142 / 0.24)",
});

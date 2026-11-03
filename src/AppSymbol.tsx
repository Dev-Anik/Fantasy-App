import { SymbolView } from "expo-symbols";
import type { SymbolViewProps } from "expo-symbols";

export function AppSymbol({
  name,
  color,
  size = 20,
}: {
  name: SymbolViewProps["name"];
  color: string;
  size?: number;
}) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      size={size}
      accessible={false}
      style={{ width: size, height: size }}
    />
  );
}

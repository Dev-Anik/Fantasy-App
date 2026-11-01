import { Pressable, Text, View } from "react-native";
import { Row } from "./fpl";

function PlayerCard({
  r,
  selected,
  onPress,
}: {
  r: Row;
  selected: boolean;
  onPress: (r: Row) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(r)}
      style={{ alignItems: "center", width: 84 }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: selected ? "#fff6a8" : "#fff",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: selected ? 4 : 2,
          borderColor: selected ? "#ff9f00" : r.cap ? "#ffd400" : "#37003c",
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "bold", color: "#37003c" }}>
          {r.team}
        </Text>
        {(r.cap || r.vice) && (
          <View
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: r.cap ? "#ffd400" : "#ccc",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "bold" }}>
              {r.cap ? "C" : "V"}
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          marginTop: 4,
          backgroundColor: "#37003c",
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 2,
          maxWidth: 84,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ color: "#fff", fontSize: 11, textAlign: "center" }}
        >
          {r.name}
        </Text>
      </View>
    </Pressable>
  );
}

function PitchRow({
  rows,
  selectedPos,
  onPress,
}: {
  rows: Row[];
  selectedPos: number | null;
  onPress: (r: Row) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-evenly",
        marginVertical: 12,
      }}
    >
      {rows.map((r) => (
        <PlayerCard
          key={r.pos}
          r={r}
          selected={selectedPos === r.pos}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

export function Pitch({
  picks,
  selectedPos,
  onPress,
}: {
  picks: Row[];
  selectedPos: number | null;
  onPress: (r: Row) => void;
}) {
  const starters = picks.filter((p) => p.pos <= 11);
  const bench = picks.filter((p) => p.pos > 11).sort((a, b) => a.pos - b.pos);
  const line = (t: number) => starters.filter((p) => p.type === t);

  return (
    <View>
      <View
        style={{
          backgroundColor: "#2e9e4f",
          marginHorizontal: 8,
          borderRadius: 12,
          paddingVertical: 8,
        }}
      >
        <PitchRow rows={line(1)} selectedPos={selectedPos} onPress={onPress} />
        <PitchRow rows={line(2)} selectedPos={selectedPos} onPress={onPress} />
        <PitchRow rows={line(3)} selectedPos={selectedPos} onPress={onPress} />
        <PitchRow rows={line(4)} selectedPos={selectedPos} onPress={onPress} />
      </View>

      <Text
        style={{
          fontSize: 16,
          fontWeight: "bold",
          margin: 16,
          marginBottom: 0,
        }}
      >
        Bench
      </Text>
      <View
        style={{
          backgroundColor: "#d9d9d9",
          marginHorizontal: 8,
          marginTop: 8,
          borderRadius: 12,
          paddingVertical: 8,
        }}
      >
        <PitchRow rows={bench} selectedPos={selectedPos} onPress={onPress} />
      </View>
    </View>
  );
}

import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Player } from "./fpl";

const PURPLE = "#37003c";
const POS = ["", "GKP", "DEF", "MID", "FWD"];

type Sort = "pts" | "cost" | "form";

export function PlayerPicker({
  visible,
  title,
  subtitle,
  candidates,
  maxCost,
  fullClubs,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  candidates: Player[];
  maxCost: number;
  fullClubs: number[];
  onPick: (p: Player) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("pts");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = candidates.filter(
      (c) =>
        !s ||
        c.name.toLowerCase().includes(s) ||
        c.team.toLowerCase().includes(s),
    );
    return [...f].sort((a, b) =>
      sort === "pts"
        ? b.pts - a.pts
        : sort === "cost"
          ? b.cost - a.cost
          : parseFloat(b.form) - parseFloat(a.form),
    );
  }, [candidates, q, sort]);

  const Chip = ({ id, label }: { id: Sort; label: string }) => (
    <Pressable
      onPress={() => setSort(id)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: sort === id ? PURPLE : "#f0edf3",
        marginRight: 8,
      }}
    >
      <Text style={{ color: sort === id ? "#fff" : "#333", fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#f6f4f8", paddingTop: 48 }}>
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 16,
            backgroundColor: "#fff",
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22,
            elevation: 3,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: PURPLE }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: 16, color: "#999" }}>Close</Text>
            </Pressable>
          </View>
          <Text style={{ color: "#666", marginTop: 4 }}>{subtitle}</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search player or club"
            style={{
              borderWidth: 1,
              borderColor: "#e1dce5",
              borderRadius: 14,
              backgroundColor: "#f7f5f8",
              paddingHorizontal: 12,
              paddingVertical: 11,
              marginTop: 10,
            }}
          />
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Chip id="pts" label="Points" />
            <Chip id="form" label="Form" />
            <Chip id="cost" label="Price" />
          </View>
        </View>

        <FlatList
          data={list}
          keyExtractor={(p) => String(p.id)}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
              No players found.
            </Text>
          }
          renderItem={({ item }) => {
            const tooPricey = item.cost > maxCost;
            const clubFull = fullClubs.includes(item.teamId);
            return (
              <Pressable
                onPress={() => onPick(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  backgroundColor: "#fff",
                  marginHorizontal: 12,
                  marginTop: 7,
                  borderRadius: 14,
                  paddingVertical: 13,
                  borderWidth: 1,
                  borderColor: "#eee9f0",
                  opacity: tooPricey || clubFull ? 0.45 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700" }}>
                    {item.name}
                    {item.status !== "a"
                      ? `  ⚠ ${item.status.toUpperCase()}`
                      : ""}
                  </Text>
                  <Text style={{ color: "#666", marginTop: 2 }}>
                    {item.team} · {POS[item.type]} · Form {item.form}
                  </Text>
                  {clubFull ? (
                    <Text
                      style={{ color: "#c0392b", fontSize: 12, marginTop: 2 }}
                    >
                      Club limit reached (3 players)
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: tooPricey ? "#c0392b" : PURPLE,
                    }}
                  >
                    £{(item.cost / 10).toFixed(1)}m
                  </Text>
                  <Text style={{ color: "#666", marginTop: 2 }}>
                    {item.pts} pts
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

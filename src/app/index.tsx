import { useRef, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";

type Row = {
  pos: number;
  name: string;
  team: string;
  type: number;
  cap: boolean;
  vice: boolean;
};
type Squad = {
  entry: number;
  gw: number;
  points: number;
  bank: number;
  chip: string | null;
  picks: Row[];
};

const TYPES = ["", "GKP", "DEF", "MID", "FWD"];

const FETCH_JS = `
(async () => {
  try {
    const j = async (u) => {
      const r = await fetch(u, { credentials: "include" });
      if (!r.ok) throw new Error(u + " -> " + r.status);
      return r.json();
    };
    const me = await j("https://fantasy.premierleague.com/api/me/");
    const entry = me.player && me.player.entry;
    if (!entry) throw new Error("লগইন করা নেই");
    const bs = await j("https://fantasy.premierleague.com/api/bootstrap-static/");
    const ev = bs.events.find(e => e.is_current) || bs.events.find(e => e.is_next) || bs.events[0];
    const data = await j("https://fantasy.premierleague.com/api/entry/" + entry + "/event/" + ev.id + "/picks/");
    const players = {};
    bs.elements.forEach(p => { players[p.id] = p; });
    const teams = {};
    bs.teams.forEach(t => { teams[t.id] = t.short_name; });
    const picks = data.picks.map(p => ({
      pos: p.position,
      name: players[p.element].web_name,
      team: teams[players[p.element].team],
      type: players[p.element].element_type,
      cap: p.is_captain,
      vice: p.is_vice_captain
    }));
    window.ReactNativeWebView.postMessage(JSON.stringify({
      ok: true,
      squad: {
        entry, gw: ev.id,
        points: data.entry_history.points,
        bank: data.entry_history.bank,
        chip: data.active_chip,
        picks
      }
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: String(e) }));
  }
})();
true;
`;

function PlayerCard({ r }: { r: Row }) {
  return (
    <View style={{ alignItems: "center", width: 74 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: r.cap ? "#ffd400" : "#37003c",
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
          maxWidth: 74,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ color: "#fff", fontSize: 11, textAlign: "center" }}
        >
          {r.name}
        </Text>
      </View>
    </View>
  );
}

function PitchRow({ rows }: { rows: Row[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-evenly",
        marginVertical: 12,
      }}
    >
      {rows.map((r) => (
        <PlayerCard key={r.pos} r={r} />
      ))}
    </View>
  );
}

export default function Index() {
  const webRef = useRef<WebView>(null);
  const [squad, setSquad] = useState<Squad | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSquad = () => {
    setError("");
    setLoading(true);
    webRef.current?.injectJavaScript(FETCH_JS);
  };

  const onMessage = (e: any) => {
    setLoading(false);
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.ok) setSquad(msg.squad);
      else setError(msg.error);
    } catch {
      setError("অপ্রত্যাশিত উত্তর: " + e.nativeEvent.data);
    }
  };

  const starters = squad ? squad.picks.filter((p) => p.pos <= 11) : [];
  const bench = squad ? squad.picks.filter((p) => p.pos > 11) : [];
  const line = (t: number) => starters.filter((p) => p.type === t);

  return (
    <View style={{ flex: 1, paddingTop: 40 }}>
      {/* WebView সবসময় থাকে, কারণ লগইন সেশন এখানেই */}
      <View style={{ flex: 1, display: squad ? "none" : "flex" }}>
        <WebView
          ref={webRef}
          source={{ uri: "https://fantasy.premierleague.com/" }}
          onMessage={onMessage}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
        />
        <View style={{ padding: 8, paddingBottom: 24 }}>
          <Button
            title={loading ? "লোড হচ্ছে..." : "লগইনের পর আমার স্কোয়াড দেখান"}
            onPress={loadSquad}
            disabled={loading}
          />
          {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
        </View>
      </View>

      {squad && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold" }}>ProFpl</Text>
            <Text style={{ marginTop: 4 }}>
              GW{squad.gw} | পয়েন্ট: {squad.points} | ব্যাংক: £
              {squad.bank / 10}m{squad.chip ? ` | চিপ: ${squad.chip}` : ""}
            </Text>
          </View>

          {/* মাঠ */}
          <View
            style={{
              backgroundColor: "#2e9e4f",
              marginHorizontal: 8,
              borderRadius: 12,
              paddingVertical: 8,
            }}
          >
            <PitchRow rows={line(1)} />
            <PitchRow rows={line(2)} />
            <PitchRow rows={line(3)} />
            <PitchRow rows={line(4)} />
          </View>

          {/* বেঞ্চ */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              margin: 16,
              marginBottom: 0,
            }}
          >
            বেঞ্চ
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
            <PitchRow rows={bench} />
          </View>

          <View style={{ margin: 20 }}>
            <Button title="WebView-তে ফিরুন" onPress={() => setSquad(null)} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

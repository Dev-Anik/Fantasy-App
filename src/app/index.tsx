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

  const renderRow = (r: Row) => (
    <Text key={r.pos} style={{ fontSize: 16, marginTop: 6 }}>
      {TYPES[r.type]} {r.name} ({r.team})
      {r.cap ? "  (C)" : r.vice ? "  (V)" : ""}
    </Text>
  );

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
        <View style={{ padding: 8 }}>
          <Button
            title={loading ? "লোড হচ্ছে..." : "লগইনের পর আমার স্কোয়াড দেখান"}
            onPress={loadSquad}
            disabled={loading}
          />
          {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
        </View>
      </View>

      {squad && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold" }}>ProFpl</Text>
          <Text style={{ marginTop: 4 }}>
            Team ID: {squad.entry} | GW{squad.gw} | পয়েন্ট: {squad.points} |
            ব্যাংক: £{squad.bank / 10}m
            {squad.chip ? ` | চিপ: ${squad.chip}` : ""}
          </Text>

          <Text style={{ fontSize: 18, fontWeight: "bold", marginTop: 16 }}>
            প্রথম একাদশ
          </Text>
          {squad.picks.filter((p) => p.pos <= 11).map(renderRow)}

          <Text style={{ fontSize: 18, fontWeight: "bold", marginTop: 16 }}>
            বেঞ্চ
          </Text>
          {squad.picks.filter((p) => p.pos > 11).map(renderRow)}

          <View style={{ marginTop: 20 }}>
            <Button
              title="রিফ্রেশ / WebView-তে ফিরুন"
              onPress={() => setSquad(null)}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

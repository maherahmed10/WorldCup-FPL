import { Placeholder } from "@/components/Placeholder";

// Maps to design: screens_market.jsx (MarketScreen) + playerlist.jsx
export default function PlayersPage() {
  return (
    <Placeholder title="Players" owner="Teammate B" designRef="design/screens_market.jsx">
      Searchable, filterable player pool (position, country, price, form).
      Reads the Player table. Shared FilterBar + PlayerRow components.
    </Placeholder>
  );
}

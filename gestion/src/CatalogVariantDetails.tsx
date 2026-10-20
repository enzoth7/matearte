type Channel = "Local" | "Web" | "Mayorista";

export function CatalogVariantDetails({ channels, onChannelChange, disabled = false }: {
  channels: Record<Channel, boolean>;
  onChannelChange: (channel: Channel, checked: boolean) => void;
  disabled?: boolean;
}) {
  return <fieldset className="catalog-variant-details">
    <legend>Canales de venta</legend>
    <div className="catalog-channel-choices" aria-label="Disponibilidad por canal">
      {(["Local", "Web", "Mayorista"] as const).map(channel => {
        return <label key={channel}>
          <input type="checkbox" checked={channels[channel]} disabled={disabled} onChange={event => onChannelChange(channel, event.target.checked)} />
          {channel}
        </label>;
      })}
    </div>
  </fieldset>;
}

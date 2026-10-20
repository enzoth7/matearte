type OrderContactPhoneProps = {
  prefix: string;
  number: string;
  country?: string;
  whatsappDigits?: string;
};

export function OrderContactPhone({ prefix, number, country, whatsappDigits }: OrderContactPhoneProps) {
  if (!number) return null;
  return <div className="order-contact-phone">
    <div className="order-contact-phone__number">
      <span className="order-contact-phone__prefix">{prefix || "Tel"}</span>
      <span>{number}</span>
      {country && <small>({country})</small>}
    </div>
    {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer">WhatsApp</a>}
  </div>;
}

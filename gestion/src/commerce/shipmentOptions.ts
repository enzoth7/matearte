export const CARRIER_OPTIONS = [
  { value: 'DAC', label: 'DAC', group: 'national' },
  { value: 'Correo Uruguayo', label: 'Correo Uruguayo', group: 'national' },
  { value: 'Copay', label: 'Copay', group: 'national' },
  { value: 'Mirtrans', label: 'Mirtrans', group: 'national' },
  { value: 'DePunta', label: 'DePunta', group: 'national' },
  { value: 'DHL Express', label: 'DHL Express', group: 'international' },
  { value: 'FedEx', label: 'FedEx', group: 'international' },
  { value: 'UPS', label: 'UPS', group: 'international' },
];

export function resolveCarrierSelection(rawCarrier?: string | null, predefinedOptions = CARRIER_OPTIONS) {
  const carrier = rawCarrier?.trim() || '';
  const matched = predefinedOptions.find(option => option.value === carrier);
  if (matched) return { selectedCarrier: matched.value, customCarrier: '', shippingCarrier: matched.value };
  if (carrier) return { selectedCarrier: '__other__', customCarrier: carrier, shippingCarrier: carrier };
  return { selectedCarrier: '', customCarrier: '', shippingCarrier: '' };
}

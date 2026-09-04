import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/es.json";

export function renderWithIntl(element: ReactElement) {
  return render(<NextIntlClientProvider locale="es" messages={messages}>{element}</NextIntlClientProvider>);
}

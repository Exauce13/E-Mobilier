import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const RESPONSIVE_BASELINE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { width: 100%; max-width: 100%; margin: 0; padding: 0; overflow-x: clip; -webkit-text-size-adjust: 100%; }
img, video, svg { max-width: 100%; }
button, [role="button"], a { touch-action: manipulation; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>E-Mobilier Bénin</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_BASELINE_CSS }} />
        {/* SDK JavaScript officiel Kkiapay chargé une seule fois au niveau du document */}
        <script
          id="kkiapay-web-sdk"
          src="https://cdn.kkiapay.me/k.js"
          defer
          dangerouslySetInnerHTML={undefined}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

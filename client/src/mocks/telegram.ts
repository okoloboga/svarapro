import { mockTelegramEnv, isTMA, emitEvent } from '@telegram-apps/sdk-react';

export async function mockTelegram(): Promise<void> {
  console.log('=== Starting mockTelegram ===');
  console.log('SessionStorage (before):', window.sessionStorage.getItem('____mocked'));
  
  const isTmaCheck = await isTMA('complete');
  console.log('isTMA("complete") result:', isTmaCheck);

    console.log('=== Applying mocks ===');
    const themeParams = {
      accent_text_color: '#6ab2f2',
      bg_color: '#17212b',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
      destructive_text_color: '#ec3942',
      header_bg_color: '#17212b',
      hint_color: '#708499',
      link_color: '#6ab3f3',
      secondary_bg_color: '#232e3c',
      section_bg_color: '#17212b',
      section_header_text_color: '#6ab3f3',
      subtitle_text_color: '#708499',
      text_color: '#f5f5f5',
    } as const;
    const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;

    mockTelegramEnv({
      onEvent(e) {
        if (e[0] === 'web_app_request_theme') {
          return emitEvent('theme_changed', { theme_params: themeParams });
        }
        if (e[0] === 'web_app_request_viewport') {
          return emitEvent('viewport_changed', {
            height: window.innerHeight,
            width: window.innerWidth,
            is_expanded: true,
            is_state_stable: true,
          });
        }
        if (e[0] === 'web_app_request_content_safe_area') {
          return emitEvent('content_safe_area_changed', noInsets);
        }
        if (e[0] === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', noInsets);
        }
      },
      launchParams: new URLSearchParams([
        ['tgWebAppPlatform', 'tdesktop'],
        ['tgWebAppVersion', '8.4'],
        ['tgWebAppThemeParams', JSON.stringify(themeParams)],
        ['tgWebAppData', new URLSearchParams([
          ['auth_date', (new Date().getTime() / 1000 | 0).toString()],
          ['hash', 'some-hash'],
          ['signature', 'mock-signature'],
          ['user', JSON.stringify({
            id: 1,
            first_name: 'Vladislav',
            username: 'vladislav',
            photo_url: 'https://ruble.website/assets/logo.png'
          })]
        ]).toString()]
      ]),
      resetPostMessage: true
    });

    window.sessionStorage.setItem('____mocked', '1');
    console.info(
      '⚠️ Telegram environment mocked for development.',
    );
}


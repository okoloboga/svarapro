import { Button } from '@/components/Button/Button';
import { YellowButton } from '@/components/Button/YellowButton';
import { StyledContainer } from '@/components/StyledContainer';
import { Eula } from '@/components/LongRead/eula';
import { Referral } from '@/components/Referral';
import { Gamerules } from '@/components/LongRead/gamerules';
import { PopSuccess } from '@/components/PopSuccess';
import { Footer } from '@/components/Footer';
import sharpIcon from '@/assets/sharp.png';
import languageIcon from '@/assets/language.png';
import depositHistoryIcon from '@/assets/deposit_history.png';
import refIcon from '@/assets/ref.png';
import channelIcon from '@/assets/channel.png';
import licenseIcon from '@/assets/license.png';
import helpIcon from '@/assets/help.png';
import supportIcon from '@/assets/support.png';
import rightIcon from '@/assets/right.png';
import copyIcon from '@/assets/copy.png';
import tetherIcon from '@/assets/tether.png';
import slideDownIcon from '@/assets/slideDown.png';
import { useMemo, useState } from 'react';
import LanguageSelector from '@/components/Language';
import { useTranslation } from 'react-i18next';
import { openTelegramLink } from '@telegram-apps/sdk';
import { useLanguage } from '@/hooks/useLanguage';
import { MoreProps } from '@/types/components';

const languageKeyMap: { [key: string]: string } = {
  ru: 'russian',
  en: 'english',
};

export function More({ userData, setCurrentPage }: MoreProps) {
  const { t } = useTranslation('common');
  const { currentLanguage } = useLanguage();
  const userId = useMemo(() => userData?.id?.toString() || 'N/A', [userData?.id]);
  const [isEulaVisible, setIsEulaVisible] = useState(false);
  const [isReferralVisible, setIsReferralVisible] = useState(false);
  const [isGamerulesVisible, setIsGamerulesVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  
  const handleCopy = () => {
    navigator.clipboard.writeText(userId).then(() => {
      setShowSuccess(true);
    });
  };

  const handleOpenNewsChannel = () => {
    openTelegramLink('https://t.me/SvaraPro');
  };

  const handleOpenSupportChat = () => {
    openTelegramLink('https://t.me/SvaraProSupportbot');
  };

  return (
    <div className="bg-primary min-h-screen flex flex-col">
      <div className="flex-1">
        {showSuccess && <PopSuccess onClose={() => setShowSuccess(false)} />}
        {/* Blur overlay and modal for language selector */}
        {showLanguageSelector && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black bg-opacity-40 backdrop-blur-sm"
              style={{ backdropFilter: 'blur(6px)' }}
              onClick={() => setShowLanguageSelector(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div onClick={(e) => e.stopPropagation()}>
                <LanguageSelector onClose={() => setShowLanguageSelector(false)} />
              </div>
            </div>
          </>
        )}
        <div className={`mx-auto w-[93vw] flex flex-col items-center space-y-3 mt-6 ${showLanguageSelector ? 'pointer-events-none select-none filter blur-sm' : ''}`}>
          <Button
            variant="secondary"
            fullWidth
            icon={sharpIcon}
            justify="start"
            onClick={handleCopy}
            rightText={userId}
            rightIcon={copyIcon}
            rightContentClassName="text-[#BBB9BD]"
            iconClassName="w-4 h-4"
            style={{ height: '53px' }}
          >
            {t('my_id')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={languageIcon}
            justify="start"
            rightText={t(languageKeyMap[currentLanguage] || 'russian')}
            rightIcon={slideDownIcon}
            rightContentClassName="text-[#BBB9BD]"
            iconClassName="w-4 h-4"
            rightIconClassName="w-[15px] h-[7px]"
            onClick={() => setShowLanguageSelector(true)}
            style={{ height: '53px' }}
          >
            {t('current_language')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={depositHistoryIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={() => setCurrentPage('depositHistory')}
            style={{ height: '53px' }}
          >
            {t('deposit_history')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={refIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={() => setIsReferralVisible(true)}
            style={{ height: '53px' }}
          >
            {t('referral_program')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={channelIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={handleOpenNewsChannel}
            style={{ height: '53px' }}
          >
            {t('news_channel')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={licenseIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={() => setIsEulaVisible(true)}
            style={{ height: '53px' }}
          >
            {t('user_agreement')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={helpIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={() => setIsGamerulesVisible(true)}
            style={{ height: '53px' }}
          >
            {t('how_to_play')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={supportIcon}
            rightIcon={rightIcon}
            justify="start"
            rightIconClassName="w-[6px] h-[17px]"
            onClick={handleOpenSupportChat}
            style={{ height: '53px' }}
          >
            {t('support_chat')}
          </Button>

          <div className="pt-4 w-full">
            <h3 className="font-semibold text-lg text-white tracking-tighter leading-tight mb-2 text-left">{t('wallet_for_withdraw')}</h3>
            <hr className="w-full border-t border-white opacity-50 mb-4" />
            <StyledContainer className="h-12">
              <div className="flex items-center justify-between w-full px-4">
                <div className="flex items-center">
                  <img src={tetherIcon} alt="USDT TON" className="w-6 h-6 mr-2" />
                  <span>USDT TON</span>
                </div>
                <YellowButton size="sm" onClick={() => setCurrentPage('addWallet')} className="w-[88px]">
                  {t('add')}
                </YellowButton>
              </div>
            </StyledContainer>
          </div>
        </div>
      </div>
      <Footer />
      {isEulaVisible && <Eula onClose={() => setIsEulaVisible(false)} />}
      {isReferralVisible && <Referral onClose={() => setIsReferralVisible(false)} />}
      {isGamerulesVisible && <Gamerules onClose={() => setIsGamerulesVisible(false)} />}
    </div>
  );
}

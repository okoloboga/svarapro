import { Button } from '../../components/Button/Button';
import { YellowButton } from '../../components/Button/YellowButton';
import { StyledContainer } from '../../components/StyledContainer';
import { Eula } from '../../components/Eula';
import { Referral } from '../../components/Referral';
import { PopSuccess } from '../../components/PopSuccess';
import sharpIcon from '../../assets/sharp.png';
import languageIcon from '../../assets/language.png';
import depositHistoryIcon from '../../assets/deposit_history.png';
import refIcon from '../../assets/ref.png';
import channelIcon from '../../assets/channel.png';
import licenseIcon from '../../assets/license.png';
import helpIcon from '../../assets/help.png';
import supportIcon from '../../assets/support.png';
import rightIcon from '../../assets/right.svg';
import copyIcon from '../../assets/copy.svg';
import tetherIcon from '../../assets/tether.png';
import slideDownIcon from '../../assets/slide-down.svg';
import { useMemo, useState } from 'react';

type Page = 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet';

type UserData = {
  id?: number | string;
  username?: string;
  photo_url?: string;
};

type MoreProps = {
  onBack: () => void;
  userData?: UserData;
  setCurrentPage: (page: Page) => void;
};

export function More({ onBack, userData, setCurrentPage }: MoreProps) {
  const userId = useMemo(() => userData?.id?.toString() || 'N/A', [userData?.id]);
  const [isEulaVisible, setIsEulaVisible] = useState(false);
  const [isReferralVisible, setIsReferralVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(userId).then(() => {
      setShowSuccess(true);
    });
  };

  return (
    <div className="bg-[#2E2B33] min-h-screen p-5">
      {showSuccess && <PopSuccess onClose={() => setShowSuccess(false)} />}
      <div className="w-full max-w-[336px] mx-auto flex flex-col items-center space-y-3">
        <div className="relative w-full">
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
          >
            Мой ID
          </Button>
        </div>
        <Button 
          variant="secondary" 
          fullWidth 
          icon={languageIcon} 
          justify="start"
          rightText="Русский"
          rightIcon={slideDownIcon}
          rightContentClassName="text-[#BBB9BD]"
          iconClassName="w-4 h-4"
        >
          Текущий язык
        </Button>
        <Button variant="secondary" fullWidth icon={depositHistoryIcon} rightIcon={rightIcon} justify="start">История Депозитов</Button>
        <Button variant="secondary" fullWidth icon={refIcon} rightIcon={rightIcon} justify="start" onClick={() => setIsReferralVisible(true)}>Партнёрская программа</Button>
        <Button variant="secondary" fullWidth icon={channelIcon} rightIcon={rightIcon} justify="start">Новостной канал</Button>
        <Button variant="secondary" fullWidth icon={licenseIcon} rightIcon={rightIcon} justify="start" onClick={() => setIsEulaVisible(true)}>Пользовательское соглашение</Button>
        <Button variant="secondary" fullWidth icon={helpIcon} rightIcon={rightIcon} justify="start">Как играть</Button>
        <Button variant="secondary" fullWidth icon={supportIcon} rightIcon={rightIcon} justify="start">Чат с поддержкой</Button>
        
        <div className="pt-4 w-full">
          <h3 className="font-semibold text-lg text-white tracking-tighter leading-tight mb-2 text-left">Кошелёк для вывода</h3>
          <hr className="w-full border-t border-white opacity-50 mb-4" />
          <StyledContainer className="h-12">
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center">
                <img src={tetherIcon} alt="USDT TON" className="w-6 h-6 mr-2" />
                <span>USDT TON</span>
              </div>
              <YellowButton size="sm" onClick={() => setCurrentPage('addWallet')} className="w-[88px]">
                Добавить
              </YellowButton>
            </div>
          </StyledContainer>
        </div>

        <div className="pt-4 w-full">
          <Button variant="secondary" onClick={onBack} fullWidth>
            Назад
          </Button>
        </div>
      </div>
      {isEulaVisible && <Eula onClose={() => setIsEulaVisible(false)} />}
      {isReferralVisible && <Referral onClose={() => setIsReferralVisible(false)} />}
    </div>
  );
}

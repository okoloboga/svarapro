import { StyledContainer } from '../StyledContainer';
import { Button } from '../Button/Button';
import closeIcon from '../../assets/close.png';
import copyIcon from '../../assets/copy.svg';
import { useEffect, useState } from 'react';
import { apiService } from '../../services/api/api';
import { PopSuccess } from '../PopSuccess';

type ReferralData = {
  referralLink?: string;
  refBalance?: string;
  refBonus?: string;
  referralCount?: number;
  referrals?: { username: string | null }[];
};

export function Referral({ onClose }: ReferralProps) {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCopy = () => {
    if (referralData?.referralLink) {
      navigator.clipboard.writeText(referralData.referralLink).then(() => {
        setShowSuccess(true);
      });
    }
  };

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setLoading(true);
        const data = (await apiService.getReferralLink()) as ReferralData;
        setReferralData(data);
      } catch (err) {
        setError('Failed to load referral data');
        console.error('Error fetching referral data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReferralData();
  }, []);

  if (loading) return <div className="fixed inset-0 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="fixed inset-0 flex items-center justify-center text-white">{error}</div>;
  if (!referralData) return null;

  const { refBalance, refBonus, referralCount, referrals } = referralData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {showSuccess && <PopSuccess onClose={() => setShowSuccess(false)} />}
      <div className="bg-[#2E2B33] w-[330px] rounded-lg p-4 relative flex flex-col items-center gap-4">
        <h2 className="text-white font-bold text-lg text-center">Партнёрская программа</h2>
        <button onClick={onClose} className="absolute top-4 right-4 z-10">
          <img src={closeIcon} alt="Close" className="w-6 h-6" />
        </button>

        {/* Статистика */}
        <div className="flex justify-between gap-2 w-full">
          <StyledContainer className="w-[150px] h-[55px]">
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-sm text-gray-400">Уровень</span>
              <span className="text-lg font-semibold text-white">{refBonus}%</span>
            </div>
          </StyledContainer>
          <StyledContainer className="w-[150px] h-[55px]">
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-sm text-gray-400">Заработок</span>
              <span className="text-lg font-semibold text-white">${refBalance}</span>
            </div>
          </StyledContainer>
        </div>

        {/* Реферальная ссылка */}
        <StyledContainer className="w-[298px] h-[141px]">
          <div className="flex flex-col items-center justify-between h-full p-2">
            <p className="font-semibold text-base leading-tight tracking-tighter text-white">Твоя реферальная ссылка</p>
            <p className="text-xs text-gray-400 break-all text-center">{referralData.referralLink}</p>
            <div className="flex justify-between gap-2 w-full">
              <Button 
                variant="tertiary" 
                onClick={handleCopy}
                className="w-[140px] h-[36px] !bg-[#2E2B33] font-medium text-sm leading-normal tracking-tighter rounded-lg"
                icon={copyIcon}
                iconClassName="w-4 h-4"
              >
                Скопировать
              </Button>
              <Button 
                variant="tertiary" 
                className="w-[140px] h-[36px] !bg-[#2E2B33] font-medium text-sm leading-normal tracking-tighter rounded-lg"
              >
                Поделиться
              </Button>
            </div>
          </div>
        </StyledContainer>

        {/* Список рефералов */}
        <div className="w-[298px]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-base leading-tight tracking-tighter text-white">Твои рефералы</h3>
            <div className="bg-[#46434B] w-[26px] h-[21px] rounded-lg flex items-center justify-center">
              <span className="font-semibold text-[13px] leading-tight tracking-tighter text-white">{referralCount}</span>
            </div>
          </div>
          <StyledContainer className="w-full h-[141px]">
            <div className="p-2 w-full h-full flex flex-col">
              <div className="flex justify-between text-xs text-gray-400 w-full">
                <span>Рефералы</span>
                <span>Профит</span>
              </div>
              <hr className="border-t border-white opacity-10 my-2 w-full" />
              {referrals?.map((ref, index) => (
                <div key={index} className="flex justify-between text-xs text-white my-1">
                  <span>{ref.username || 'Без имени'}</span>
                  <span>$0.00</span>
                </div>
              ))}
            </div>
          </StyledContainer>
        </div>
      </div>
    </div>
  );
}

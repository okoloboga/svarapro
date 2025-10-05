import { cn } from "@/utils/cn"
import { HTMLAttributes } from "react"
import coinImage from '@/assets/game/coin.png';

interface Props extends HTMLAttributes<HTMLDivElement> {
    classNameImage?: string;
}

export const Coin = ({className, classNameImage, ...props}: Props) => {
    return(
        <div className={cn(className)} {...props}>
            <img className={cn('min-w-[15px] w-[15px] h-[13px]', classNameImage)} src={coinImage} alt="Coin" />
        </div>
    )
}
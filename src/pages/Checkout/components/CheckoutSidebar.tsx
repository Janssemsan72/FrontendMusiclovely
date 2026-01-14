import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Edit, Gift, CheckCircle2 } from '@/utils/iconImports';
import { useTranslation } from '@/hooks/useTranslation';
import CheckoutPlanSelection from './CheckoutPlanSelection';
import CheckoutAudioPlayer from './CheckoutAudioPlayer';

type PlanId = 'standard' | 'express';

type Plan = {
  id: PlanId;
  name: string;
  price: number;
  currency: 'BRL';
  delivery: string;
  featured: boolean;
  features: string[];
};

interface QuizData {
  about_who?: string;
}

interface CheckoutSidebarProps {
  quiz: QuizData | null;
  selectedPlan: PlanId;
  selectedPlanData: Plan;
  plans: Plan[];
  onPlanSelect: (planId: PlanId) => void;
  currentLanguage: string;
  onEditQuiz: () => void;
  songs: Array<{ title: string; orderedBy: string }>;
  currentlyPlaying: number | null;
  currentTimes: { [key: number]: number };
  durations: { [key: number]: number };
  onTogglePlay: (index: number) => void;
  formatTime: (seconds: number) => string;
}

export default function CheckoutSidebar({
  quiz,
  selectedPlan,
  selectedPlanData,
  plans,
  onPlanSelect,
  currentLanguage,
  onEditQuiz,
  songs,
  currentlyPlaying,
  currentTimes,
  durations,
  onTogglePlay,
  formatTime
}: CheckoutSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="order-2 lg:order-1 space-y-2 md:space-y-4">
      {/* Your Custom Song Order */}
      <Card className="compact-card hidden md:block">
        <CardHeader className="pb-3 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-xl font-bold">
            <Music className="h-5 w-5 md:h-5 md:w-5 text-primary" />
            {t('checkout.customSongOrder')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="space-y-3 md:space-y-3">
            <div className="flex items-center justify-between text-base md:text-base">
              <span className="text-muted-foreground">{t('checkout.musicFor')}</span>
              <span className="font-medium">{quiz?.about_who}</span>
            </div>
            <div className="flex items-center justify-between text-base md:text-base">
              <span className="text-muted-foreground">{t('checkout.delivery')}</span>
              <span className="font-medium">
                {selectedPlan === 'express' ? t('checkout.deliveryIn48h') : t('checkout.deliveryIn7Days')}
              </span>
            </div>
          </div>

          <div className="border-t pt-4 md:pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base md:text-base font-medium">{t('checkout.personalizedMusic')}</span>
                <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-sm md:text-sm">
                  {t('checkout.discount70')}
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base md:text-base text-muted-foreground line-through">
                  R$ {(selectedPlanData.price / 100 * 3.3).toFixed(2)}
                </span>
                <span className="text-2xl md:text-2xl font-bold text-primary">
                  R$ {(selectedPlanData.price / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-base md:text-base py-5"
            onClick={onEditQuiz}
          >
            <Edit className="mr-2 h-4 w-4" />
            {t('checkout.reviewQuestionnaire')}
          </Button>
        </CardContent>
      </Card>

      {/* Plan Selection - Desktop */}
      <CheckoutPlanSelection
        plans={plans}
        selectedPlan={selectedPlan}
        onPlanSelect={onPlanSelect}
        variant="desktop"
        currentLanguage={currentLanguage}
      />

      {/* Limited Time Discount */}
      <Card className="compact-card border-orange-200 bg-orange-50 hidden md:block">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm md:text-sm">
            <Gift className="h-4 w-4 md:h-4 md:w-4 text-orange-600" />
            <span className="text-orange-900">{t('checkout.limitedTimeDiscount')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs md:text-xs space-y-2 p-4 md:p-4">
          <p className="text-orange-900">
            {t('checkout.normalPrice')} <strong>R$ 299</strong>, {t('checkout.butWeBelieve')}{' '}
            <strong>R$ {(selectedPlanData.price / 100).toFixed(2)}</strong> {t('checkout.forLimitedTime')}.
          </p>
          <p className="text-orange-900 font-semibold">
            Música com Qualidade de studio HD
          </p>
          <p className="text-orange-900">
            <strong>{t('checkout.whyOnly')} R$ {(selectedPlanData.price / 100).toFixed(2)}?</strong> {t('checkout.weArePassionate')}.
          </p>
        </CardContent>
      </Card>

      {/* Hear Other Songs We Made */}
      <CheckoutAudioPlayer
        songs={songs}
        currentlyPlaying={currentlyPlaying}
        currentTimes={currentTimes}
        durations={durations}
        onTogglePlay={onTogglePlay}
        formatTime={formatTime}
      />

      {/* 100% Money Back Guarantee */}
      <Card className="compact-card border-green-200 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
            <span className="text-green-900">{t('checkout.moneyBackGuarantee')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 md:p-6">
          {[
            { title: t('checkout.notSatisfied'), subtitle: t('checkout.noQuestions') },
            { title: t('checkout.guarantee30DaysFull'), subtitle: t('checkout.timeToDecide') },
            { title: t('checkout.riskFreePurchase'), subtitle: t('checkout.satisfactionPriority') }
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-900">{item.title}</p>
                <p className="text-xs text-green-700">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What You'll Get */}
      <Card className="compact-card hidden md:block">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Gift className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            {t('checkout.whatYouWillReceive')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 md:p-6">
          {[
            { title: t('checkout.radioQuality'), subtitle: t('checkout.radioQualitySubtitle') },
            { title: t('checkout.personalizedLyrics'), subtitle: t('checkout.writtenFor') + ' ' + quiz?.about_who },
            { title: selectedPlan === 'express' ? t('checkout.delivery24hTitle') : t('checkout.delivery7DaysTitle'), subtitle: t('checkout.perfectForLastMinute') }
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Why Choose MusicLovely */}
      <Card className="compact-card hidden md:block">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            {t('checkout.whyChooseMusicLovely')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 md:p-6">
          {[
            t('checkout.over1000Clients'),
            t('checkout.satisfactionGuarantee'),
            t('checkout.securePaymentProcessing'),
            t('checkout.deliveredIn7Days')
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

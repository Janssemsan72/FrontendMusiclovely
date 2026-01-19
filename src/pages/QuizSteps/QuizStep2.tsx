import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';

interface QuizStep2Props {
  formData: {
    style: string;
    vocalGender: string;
  };
  styles: readonly string[];
  vocalOptions: readonly { value: string; label: string }[];
  updateField: (field: string, value: string) => void;
  markFieldTouched: (field: string) => void;
  hasFieldError: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
}

export default function QuizStep2({
  formData,
  styles,
  vocalOptions,
  updateField,
  markFieldTouched,
  hasFieldError,
  getFieldError
}: QuizStep2Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1 md:space-y-2">
      <div>
        <Label className="text-lg md:text-lg font-semibold mb-0.5 md:mb-1 block">
          {t('quiz.questions.styleQuestion')} *
        </Label>
        <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mb-1.5 md:mb-1.5 leading-snug">
          {t('quiz.questions.styleDescription')}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
        {styles.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => {
              updateField('style', style);
              markFieldTouched('style');
            }}
            className={`px-3 py-2 md:px-4 md:py-2 rounded-full !border-2 transition-all font-medium text-base md:text-sm ${
              formData.style === style
                ? '!border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                : '!border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:!border-[hsl(var(--quiz-primary))]'
            }`}
            style={{
              borderWidth: '2px',
              borderRadius: '9999px',
              borderStyle: 'solid',
              borderColor: formData.style === style ? '#C85A3E' : '#E5E5E5'
            }}
          >
            {style}
          </button>
        ))}
      </div>
      {hasFieldError('style') && (
        <p className="text-lg md:text-base text-red-500 mt-1">
          {getFieldError('style')}
        </p>
      )}

      <div className="border-t border-[hsl(var(--quiz-border))] pt-1.5 md:pt-2 mt-2 md:mt-2.5">
        <div>
          <Label className="text-lg md:text-lg font-semibold mb-0.5 md:mb-1 block">
            {t('quiz.questions.vocalPreference')} *
          </Label>
          <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mb-1.5 md:mb-1.5 leading-snug">
            {t('quiz.questions.vocalDescription')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-0.5 md:gap-2">
          {vocalOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                updateField('vocalGender', option.value);
                markFieldTouched('vocal_gender');
              }}
              className={`px-2 py-1.5 md:px-4 md:py-2 rounded-full !border-2 transition-all font-medium text-base md:text-sm whitespace-nowrap ${
                formData.vocalGender === option.value
                  ? '!border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                  : '!border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:!border-[hsl(var(--quiz-primary))]'
              }`}
              style={{
                borderWidth: '2px',
                borderRadius: '9999px',
                borderStyle: 'solid',
                borderColor: formData.vocalGender === option.value ? '#C85A3E' : '#E5E5E5'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {hasFieldError('vocal_gender') && (
          <p className="text-lg md:text-base text-red-500 mt-1">
            {getFieldError('vocal_gender')}
          </p>
        )}
      </div>
    </div>
  );
}

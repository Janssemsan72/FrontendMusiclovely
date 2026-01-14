import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';

interface QuizStep1Props {
  formData: {
    relationship: string;
    customRelationship: string;
    aboutWho: string;
  };
  relationships: readonly string[];
  updateField: (field: string, value: string) => void;
  markFieldTouched: (field: string) => void;
  hasFieldError: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
}

export default function QuizStep1({
  formData,
  relationships,
  updateField,
  markFieldTouched,
  hasFieldError,
  getFieldError
}: QuizStep1Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5 md:space-y-4">
      <div>
        <Label className="text-lg md:text-lg font-semibold mb-2 md:mb-2 block">
          {t('quiz.questions.forWho')} *
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-2.5">
          {relationships.map((rel) => (
            <button
              key={rel}
              type="button"
              onClick={() => updateField('relationship', rel)}
              className={`px-4 py-2.5 md:px-4 md:py-2.5 rounded-full border-2 transition-all font-medium text-lg md:text-base ${
                formData.relationship === rel
                  ? 'border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                  : 'border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:border-[hsl(var(--quiz-primary))]'
              }`}
            >
              {rel}
            </button>
          ))}
        </div>
        {formData.relationship === t('quiz.relationships.other') && (
          <div className="mt-3 md:mt-3">
            <Input
              placeholder={t('quiz.questions.enterRelationship')}
              value={formData.customRelationship}
              onChange={(e) => {
                updateField('customRelationship', e.target.value);
                markFieldTouched('customRelationship');
              }}
              onBlur={() => markFieldTouched('customRelationship')}
              className={`border-[hsl(var(--quiz-border))] text-lg md:text-base py-2.5 md:py-3 ${
                hasFieldError('customRelationship') ? 'border-red-500' : ''
              }`}
            />
            {hasFieldError('customRelationship') && (
              <p className="text-base md:text-sm text-red-500 mt-1">
                {getFieldError('customRelationship')}
              </p>
            )}
            <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mt-1">
              {formData.customRelationship.length}/100 {t('quiz.characterCount.characters')}
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="aboutWho" className="text-lg md:text-lg font-semibold mb-1.5 md:mb-2 block">
          {t('quiz.questions.name')} *
        </Label>
        <Input
          id="aboutWho"
          placeholder={t('quiz.questions.namePlaceholder')}
          value={formData.aboutWho}
          onChange={(e) => {
            updateField('aboutWho', e.target.value);
            markFieldTouched('about_who');
          }}
          onBlur={() => markFieldTouched('about_who')}
          className={`border-[hsl(var(--quiz-border))] text-lg md:text-base py-2.5 md:py-3 ${
            hasFieldError('about_who') ? 'border-red-500' : ''
          }`}
        />
        {hasFieldError('about_who') && (
          <p className="text-base md:text-sm text-red-500 mt-1">
            {getFieldError('about_who')}
          </p>
        )}
        <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mt-1">
          {t('quiz.questions.nameHint')} ({formData.aboutWho.length}/100 {t('quiz.characterCount.characters')})
        </p>
      </div>
    </div>
  );
}

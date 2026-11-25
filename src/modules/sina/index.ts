import { getWorkspace } from '@/modules/workspace';
import { createSinaChat } from './application/chat';
import { generateWithAnthropic } from './infrastructure/anthropic';

export const askSina = createSinaChat({
  readContext(userId) {
    const { state } = getWorkspace(userId);
    if (!state) return null;
    return {
      etapaDiagnostico: state.step,
      rutaGenerada: state.finalized,
      actividad: state.diagnosis.business,
      modalidadUbicacion: state.diagnosis.location,
      figuraJuridica: state.diagnosis.legalForm,
      tramitesCompletados: state.completed,
    };
  },
  generate: generateWithAnthropic,
});

import { parseAllyApplication, type AllyApplication, type ApplicationReceipt } from '../domain/application';

interface ApplicationRepository {
  recordApplication(userId: string, input: AllyApplication): ApplicationReceipt;
  listApplications(userId: string): ApplicationReceipt[];
}

export function createAllyApplications({ recordApplication, listApplications }: ApplicationRepository) {
  return {
    getAllyApplications: listApplications,
    submitAllyApplication(userId: string, input: Record<string, unknown>) {
      const receipt = recordApplication(userId, parseAllyApplication(input));
      return { ...receipt, message: 'Tu petición fue enviada y será estudiada.' };
    },
  };
}

import { REPOSITORY_ROLE } from '../generic/authRole';
import { getUserRecordActionLinks, LGRecordActionLink, RECORD_ACTION } from './lloydGeorgeActions';
import { describe, expect, it } from 'vitest';

describe('getUserRecordActionLinks', () => {
    describe('When role = GP_ADMIN', () => {
        it('returns record links for remove record and download record', () => {
            const role = REPOSITORY_ROLE.GP_ADMIN;
            const hasRecordInRepo = true;
            const expectedOutput = expect.arrayContaining([
                expect.objectContaining({
                    label: 'Remove this document',
                    key: 'delete-files-link',
                    type: RECORD_ACTION.UPDATE,
                }),
                expect.objectContaining({
                    label: 'Download this document',
                    key: 'download-files-link',
                    type: RECORD_ACTION.DOWNLOAD,
                }),
            ]);

            const actual = getUserRecordActionLinks({
                role,
                hasRecordInStorage: hasRecordInRepo,
            });

            expect(actual).toEqual(expectedOutput);
        });
        it('returns an empty array if no record in repo (aka nothing to download or remove)', () => {
            const role = REPOSITORY_ROLE.GP_ADMIN;
            const hasRecordInRepo = false;
            const expectedOutput: Array<LGRecordActionLink> = [];
            const actual = getUserRecordActionLinks({
                role,
                hasRecordInStorage: hasRecordInRepo,
            });

            expect(actual).toEqual(expectedOutput);
        });
    });

    describe('When role = GP_CLINICAL', () => {
        it('returns no remove record button', () => {
            const role = REPOSITORY_ROLE.GP_CLINICAL;

            const expected = expect.arrayContaining([
                expect.objectContaining({
                    label: 'Download this document',
                    key: 'download-files-link',
                    type: RECORD_ACTION.DOWNLOAD,
                }),
            ]);

            const actual = getUserRecordActionLinks({ role, hasRecordInStorage: true });

            expect(actual).toEqual(expected);
        });
    });
});

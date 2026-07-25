export interface DiagnosisPart {
    id: string;
    name: string;
    quantity: number;
    price: number;
}
export interface DiagnosisService {
    id: string;
    name: string;
    price: number;
}
export class Diagnosis {
    constructor(public readonly parts: DiagnosisPart[], public readonly services: DiagnosisService[]) { }
}

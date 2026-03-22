/**
 * ebd-methods.js — Métodos do Store relacionados ao módulo EBD.
 * Aplicado via Object.assign(Store.prototype, ebdMethods) em store.js.
 */

export const ebdMethods = {
    // ── Classes ──────────────────────────────────────────────────────────────
    async fetchEbdClasses() {
        this.ebdClasses = await this.apiFetch('/ebd/classes') || [];
    },

    async addEbdClass(data) {
        const created = await this.apiFetch('/ebd/classes', { method: 'POST', body: JSON.stringify(data) });
        if (created?.id) {
            const professor        = created.professorId        ? (this.users || []).find(u => u.id === created.professorId)        || null : null;
            const segundoProfessor = created.segundoProfessorId ? (this.users || []).find(u => u.id === created.segundoProfessorId) || null : null;
            const terceiroProfessor= created.terceiroProfessorId? (this.users || []).find(u => u.id === created.terceiroProfessorId)|| null : null;
            this.ebdClasses = [...this.ebdClasses, { ...created, professor, segundoProfessor, terceiroProfessor, _count: { students: 0 } }];
        }
        return created;
    },

    async updateEbdClass(id, data) {
        const updated = await this.apiFetch(`/ebd/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        if (updated?.id) {
            const professor        = updated.professorId        ? (this.users || []).find(u => u.id === updated.professorId)        || null : null;
            const segundoProfessor = updated.segundoProfessorId ? (this.users || []).find(u => u.id === updated.segundoProfessorId) || null : null;
            const terceiroProfessor= updated.terceiroProfessorId? (this.users || []).find(u => u.id === updated.terceiroProfessorId)|| null : null;
            const existing = this.ebdClasses.find(c => c.id === id);
            this.ebdClasses = this.ebdClasses.map(c => c.id === id
                ? { ...updated, professor, segundoProfessor, terceiroProfessor, _count: existing?._count || { students: 0 } }
                : c);
        }
        return updated;
    },

    // ── Alunos ───────────────────────────────────────────────────────────────
    async getEbdStudents(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/students`) || [];
    },

    async enrollEbdStudent(classId, personId) {
        const result = await this.apiFetch(`/ebd/classes/${classId}/students`, {
            method: 'POST', body: JSON.stringify({ personId })
        });
        this.ebdClasses = this.ebdClasses.map(c => c.id === classId
            ? { ...c, _count: { ...c._count, students: (c._count?.students || 0) + 1 } }
            : c);
        return result;
    },

    async removeEbdStudent(classId, studentId) {
        const result = await this.apiFetch(`/ebd/classes/${classId}/students/${studentId}`, { method: 'DELETE' });
        this.ebdClasses = this.ebdClasses.map(c => c.id === classId
            ? { ...c, _count: { ...c._count, students: Math.max(0, (c._count?.students || 1) - 1) } }
            : c);
        return result;
    },

    // ── Chamada ───────────────────────────────────────────────────────────────
    async getEbdAttendance(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/attendance`) || [];
    },

    async saveEbdAttendance(classId, data) {
        return await this.apiFetch(`/ebd/classes/${classId}/attendance`, {
            method: 'POST', body: JSON.stringify(data)
        });
    },

    // ── Ofertas ───────────────────────────────────────────────────────────────
    async getEbdOfferings(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/offerings`) || [];
    },

    async addEbdOffering(classId, data) {
        return await this.apiFetch(`/ebd/classes/${classId}/offerings`, {
            method: 'POST', body: JSON.stringify(data)
        });
    },
};

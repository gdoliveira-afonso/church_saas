const express = require('express');
const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');

const router = express.Router();

// Lista todos os usuários da organização
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;

        if (!orgId && req.user.role !== 'SUPERADMIN') {
            return res.json([]);
        }

        const users = await prisma.user.findMany({
            where: orgId ? { organizationId: orgId } : {},
            select: { id: true, name: true, username: true, role: true, avatar: true, generationId: true, organizationId: true, secondaryRoles: true }
        });
        res.json(users);
    } catch (error) {
        console.error("[Users GET Error]:", error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Busca um usuário (dentro da organização)
router.get('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const user = await prisma.user.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true, name: true, username: true, role: true, avatar: true, generationId: true, organizationId: true, secondaryRoles: true }
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// Cria usuário (vinculado à organização)
router.post('/', async (req, res) => {
    const { name, username, password, role, avatar, generationId, secondaryRoles } = req.body;
        const orgId = req.orgId;

    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    // Segurança: apenas SUPERADMIN pode criar outros SUPERADMINs
    const requestedRole = role || 'USER';
    if (requestedRole === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Apenas Superadmins podem criar usuários com esse nível de acesso.' });
    }

    const VALID_SECONDARY_ROLES = ['PROFESSOR', 'SEGUNDO_PROFESSOR', 'SUPERINTENDENTE_EBD'];
    const secondaryRolesJson = Array.isArray(secondaryRoles)
        ? JSON.stringify(secondaryRoles.filter(r => VALID_SECONDARY_ROLES.includes(r)))
        : null;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                role: requestedRole,
                avatar: avatar || null,
                generationId: generationId || null,
                organizationId: orgId,
                secondaryRoles: secondaryRolesJson
            },
            select: { id: true, name: true, username: true, role: true, avatar: true, generationId: true, organizationId: true, secondaryRoles: true }
        });


        // Se o usuário criado for um Líder, Vice ou Líder de Geração, cria o perfil correspondente na tabela de Pessoas
        if (user.role === 'LEADER' || user.role === 'VICE_LEADER' || user.role === 'LIDER_GERACAO') {
            let personStatus;
            if (user.role === 'LEADER') personStatus = 'Líder';
            else if (user.role === 'VICE_LEADER') personStatus = 'Vice-Líder';
            else personStatus = 'Líder de Geração';

            await prisma.person.create({
                data: {
                    name: user.name,
                    status: personStatus,
                    userId: user.id,
                    organizationId: orgId
                }
            });
        }

        res.status(201).json(user);
        req.log?.('CREATE', 'users', user.id, `${user.name} (${user.username})`);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Atualiza usuário (dentro da organização)
router.put('/:id', async (req, res) => {
    const { name, username, password, role, avatar, generationId, secondaryRoles } = req.body;
        const orgId = req.orgId;
    const updateData = { name, username, role, avatar, generationId: generationId || null };

    if (secondaryRoles !== undefined) {
        const VALID_SECONDARY_ROLES = ['PROFESSOR', 'SEGUNDO_PROFESSOR', 'SUPERINTENDENTE_EBD'];
        updateData.secondaryRoles = Array.isArray(secondaryRoles)
            ? JSON.stringify(secondaryRoles.filter(r => VALID_SECONDARY_ROLES.includes(r)))
            : null;
    }

    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }

    try {
        const existingUser = await prisma.user.findFirst({ 
            where: { id: req.params.id, organizationId: orgId } 
        });
        
        if (!existingUser) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

        if (password) {
            updateData.tokenVersion = (existingUser.tokenVersion || 0) + 1;
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: { id: true, name: true, username: true, role: true, avatar: true, generationId: true, organizationId: true, secondaryRoles: true }
        });
        res.json(user);
        req.log?.('UPDATE', 'users', user.id, `${user.name} (${user.username})`);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// Alterar senha (com validação da senha atual)
router.put('/:id/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const targetId = req.params.id;
        const orgId = req.orgId;

    // Apenas o próprio usuário ou um ADMIN pode trocar a senha
    if (req.user.id !== targetId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Sem permissão' });
    }

    try {
        const user = await prisma.user.findFirst({ 
            where: { id: targetId, organizationId: orgId } 
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: targetId },
            data: {
                password: hashedPassword,
                tokenVersion: (user.tokenVersion || 0) + 1
            }
        });

        res.json({ success: true, message: 'Senha alterada com sucesso' });
        req.log?.('UPDATE', 'users', user.id, `Alterou senha de ${user.username}`);
    } catch (error) {
        console.error('Erro detalhado ao alterar senha:', error);
        res.status(500).json({ error: 'Erro ao alterar senha: ' + error.message });
    }
});

// POST /:id/reset-password — Admin redefine senha de outro usuário (sem precisar da senha atual)
router.post('/:id/reset-password', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem redefinir senhas.' });
        }

        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
        }

        const user = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, tokenVersion: (user.tokenVersion || 0) + 1 }
        });

        res.json({ success: true, message: 'Senha redefinida com sucesso.' });
        req.log?.('UPDATE', 'users', user.id, `Admin redefiniu senha de ${user.username}`);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
});

// Deleta usuário (dentro da organização)
router.delete('/:id', async (req, res) => {
    try {
            const orgId = req.orgId;

        // Evita que o usuário delete a si mesmo
        if (req.user && req.user.id === req.params.id) {
            return res.status(400).json({ error: 'Você não pode deletar a si mesmo' });
        }

        const user = await prisma.user.findFirst({ 
            where: { id: req.params.id, organizationId: orgId } 
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

        await prisma.user.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
        req.log?.('DELETE', 'users', req.params.id, `${user.name} (${user.username})`);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

module.exports = router;

/**
 * fix-paz1-access.js
 * Diagnóstico e correção de acesso para orgs acessadas via subdomínio
 * sem SAAS_DOMAIN configurado.
 *
 * Uso: node fix-paz1-access.js [slug-da-org] [nova-senha-do-admin]
 * Ex:  node fix-paz1-access.js paz1 minhasenha123
 *
 * Se a nova senha não for informada, apenas diagnostica sem alterar.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const targetSlug = process.argv[2] || 'paz1';
const newPassword = process.argv[3] || null;

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(`  DIAGNÓSTICO DE ACESSO — Org: "${targetSlug}"`);
    console.log('══════════════════════════════════════════════════\n');

    // 1. Verifica SAAS_DOMAIN
    const saasDomain = process.env.SAAS_DOMAIN || '';
    console.log(`[ENV] SAAS_DOMAIN = "${saasDomain || '(não configurado)'}"`);
    if (!saasDomain) {
        console.log('⚠️  SAAS_DOMAIN não está definido no .env!');
        console.log('   Isso significa que subdomínios como paz1.graphitenetworks.com.br');
        console.log('   NÃO são reconhecidos automaticamente pelo servidor.\n');
    } else {
        console.log(`✅ SAAS_DOMAIN configurado. Subdomínios de "${saasDomain}" são resolvidos automaticamente.\n`);
    }

    // 2. Busca a organização
    const org = await prisma.organization.findFirst({
        where: {
            OR: [
                { slug: targetSlug },
                { subdomain: targetSlug },
                { customDomain: targetSlug },
                { customDomain: `paz1.graphitenetworks.com.br` }
            ]
        }
    });

    if (!org) {
        console.log(`❌ Organização com slug/subdomain "${targetSlug}" NÃO ENCONTRADA no banco de dados.`);
        console.log('\nOrganizações cadastradas:');
        const all = await prisma.organization.findMany({ select: { id: true, name: true, slug: true, subdomain: true, customDomain: true, status: true } });
        if (all.length === 0) {
            console.log('  (nenhuma organização encontrada)');
        } else {
            all.forEach(o => console.log(`  - ${o.name} | slug: ${o.slug} | subdomain: ${o.subdomain} | customDomain: ${o.customDomain || '(nenhum)'} | status: ${o.status}`));
        }
        process.exit(1);
    }

    console.log('✅ Organização encontrada:');
    console.log(`   ID:           ${org.id}`);
    console.log(`   Nome:         ${org.name}`);
    console.log(`   Slug:         ${org.slug}`);
    console.log(`   Subdomain:    ${org.subdomain}`);
    console.log(`   CustomDomain: ${org.customDomain || '(nenhum)'}`);
    console.log(`   Status:       ${org.status}`);
    console.log(`   Plano:        ${org.plan}`);

    if (org.status === 'suspended') {
        console.log('\n⚠️  A organização está SUSPENSA! Login será bloqueado pelo servidor.');
        console.log('   Reative pelo painel de superadmin ou execute:');
        console.log(`   UPDATE Organization SET status='active' WHERE id='${org.id}';\n`);
    }

    // 3. Busca usuários da org
    const users = await prisma.user.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true, username: true, role: true, tokenVersion: true }
    });

    console.log(`\n👥 Usuários da organização (${users.length} encontrado(s)):`);
    if (users.length === 0) {
        console.log('   ❌ NENHUM USUÁRIO! A organização não tem usuários — impossível logar.');
        console.log('   Crie um usuário pelo painel de superadmin ou rode este script com:');
        console.log(`   node fix-paz1-access.js ${targetSlug} novasenha123`);
    } else {
        users.forEach(u => console.log(`   - ${u.username} (${u.role}) — ${u.name}`));
    }

    // 4. Diagnóstico de resolução de host
    console.log('\n🔍 Diagnóstico de resolução de host:');
    const hostname = 'paz1.graphitenetworks.com.br';
    if (!saasDomain) {
        const byCustomDomain = await prisma.organization.findFirst({ where: { customDomain: hostname } });
        if (byCustomDomain) {
            console.log(`   ✅ Host "${hostname}" resolvido via customDomain → org "${byCustomDomain.name}"`);
        } else {
            console.log(`   ❌ Host "${hostname}" NÃO RESOLVIDO (sem SAAS_DOMAIN e sem customDomain configurado)`);
            console.log('   → O servidor retorna { dev: true } e carrega a org "matriz" no lugar!');
            console.log('   → O login falha porque o usuário pertence à org "paz1", não à "matriz"\n');

            console.log('══════════════════════════════════════════════════');
            console.log('  CORREÇÃO NECESSÁRIA — escolha uma das opções:');
            console.log('══════════════════════════════════════════════════');
            console.log('\n  OPÇÃO 1 (recomendada): Definir SAAS_DOMAIN no .env');
            console.log('    Adicione ao server/.env:');
            console.log('    SAAS_DOMAIN=graphitenetworks.com.br\n');
            console.log('  OPÇÃO 2: Definir customDomain da org (sem precisar de SAAS_DOMAIN)');
            console.log(`    Execute: node fix-paz1-access.js ${targetSlug} --set-custom-domain\n`);
            console.log('  OPÇÃO 3: Workaround imediato sem alterar config');
            console.log(`    Acesse: http://paz1.graphitenetworks.com.br:5173/?org=${targetSlug}#/login\n`);

            // Aplica fix de customDomain se solicitado
            if (process.argv[3] === '--set-custom-domain') {
                await prisma.organization.update({
                    where: { id: org.id },
                    data: { customDomain: hostname }
                });
                console.log(`  ✅ customDomain definido como "${hostname}" para a org "${org.name}"`);
                console.log('  Reinicie o servidor e tente logar novamente.\n');
            }
        }
    } else if (hostname.endsWith(`.${saasDomain}`)) {
        const sub = hostname.slice(0, hostname.length - saasDomain.length - 1);
        console.log(`   Subdomain extraído: "${sub}"`);
        const found = await prisma.organization.findFirst({ where: { OR: [{ slug: sub }, { subdomain: sub }] } });
        if (found) {
            console.log(`   ✅ Resolvido via subdomínio → org "${found.name}" (${found.slug})`);
        } else {
            console.log(`   ❌ Subdomínio "${sub}" não mapeado a nenhuma org!`);
            console.log(`   O slug/subdomain da org deve ser "${sub}". Org atual tem slug="${org.slug}", subdomain="${org.subdomain}"`);
        }
    }

    // 5. Reseta senha se solicitado
    if (newPassword && newPassword !== '--set-custom-domain') {
        const adminUser = users.find(u => u.role === 'ADMIN') || users[0];
        if (!adminUser) {
            console.log('\n❌ Nenhum usuário para resetar senha.');
        } else {
            const hashed = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: adminUser.id },
                data: { password: hashed, tokenVersion: (adminUser.tokenVersion || 0) + 1 }
            });
            console.log(`\n✅ Senha do usuário "${adminUser.username}" (${adminUser.role}) resetada com sucesso!`);
            console.log(`   Nova senha: ${newPassword}`);
            console.log('   IMPORTANTE: Troque esta senha após o primeiro login!\n');
        }
    }

    console.log('\n══════════════════════════════════════════════════\n');
}

main()
    .catch(e => { console.error('Erro:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

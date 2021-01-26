//'use strict';
require('dotenv').config()
var cron = require('node-cron');
const puppeteer = require('puppeteer');

const splinterlandsPage = require('./splinterlandsPage');
const user = require('./user');
const cardsDetails = require("./data/cardsDetails.json"); //saved json from api endpoint https://game-api.splinterlands.com/cards/get_details?
const card = require('./cards');
const helper = require('./helper');

const ask = require('./possibleTeams');

async function startBotPlayMatch(browser) {
    const page = await browser.newPage();
    await page.setViewport({
        width: 1500,
        height: 800,
        deviceScaleFactor: 1,
    });

    await page.goto('https://splinterlands.io/');
    await page.waitFor(4000);
    await splinterlandsPage.login(page);
    await page.waitFor(5000);
    await page.reload();
    await page.waitFor(5000);
    await page.reload();
    await page.waitFor(5000);
    await page.reload();
    await page.waitFor(5000);

    await page.click('#menu_item_battle');

    // LOAD MY CARDS
    const myCards = await user.getPlayerCards(process.env.ACCOUNT.split('@')[0])
    console.log(process.env.ACCOUNT)

    //if quest done claim reward
    try {
        await page.waitForSelector('#quest_claim_btn', { timeout: 5000 })
            .then(button => button.click());
    } catch (e) {
        console.log('no quest reward')
    }

    await page.waitFor(30000);

    // LAUNCH the battle
    await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 10000 })
        .then(button => button.click());
    await page.waitFor(30000);

    await page.waitForSelector('.btn--create-team', { timeout: 90000 })
    let [mana, rules, splinters] = await Promise.all([
        splinterlandsPage.checkMatchMana(page).then((mana) => mana).catch(() => 'no mana'),
        splinterlandsPage.checkMatchRules(page).then((rulesArray) => rulesArray).catch(() => 'no rules'),
        splinterlandsPage.checkMatchActiveSplinters(page).then((splinters) => splinters).catch(() => 'no splinters')
    ]);

    const matchDetails = {
        mana: mana,
        rules: rules,
        splinters: splinters,
        myCards: myCards
    }

    const possibleTeams = await ask.possibleTeams(matchDetails);

    if (possibleTeams && possibleTeams.length) {
        console.log('Possible Teams: ', possibleTeams.length, '\n', possibleTeams);
    } else {
        //page.click('.btn--surrender')[0]; //commented to prevent alert dialog
        await browser.close();
        throw new Error('NO TEAMS available to be played');
    }

    //TEAM SELECTION
    const teamToPlay = await ask.teamSelection(possibleTeams, matchDetails);
    // const bestCombination = battles.mostWinningSummonerTank(possibleTeams)
    // console.log('BEST SUMMONER and TANK', bestCombination)
    // if (bestCombination.summonerWins > 1) {
    //     const bestTeam = await possibleTeams.find(x => x[0] == bestCombination.bestSummoner)
    //     console.log('BEST TEAM', bestTeam)
    //     if (matchDetails.splinters.includes(helper.teamSplinterToPlay(bestTeam).toLowerCase())) {
    //         console.log('PLAY BEST SUMMONER and TANK: ', helper.teamSplinterToPlay(bestTeam), bestTeam)
    //         const summoner = card.makeCardId(bestTeam[0].toString());
    //         return [summoner, bestTeam];
    //     }

    // }

    // //TO UNCOMMENT FOR QUEST after choose the color
    // if (matchDetails.splinters.includes('fire') && possibleTeams.find(x => x[7] === 'fire')) {
    //     const fireTeam = possibleTeams.find(x => x[7] === 'fire')
    //     try {
    //         if (matchDetails.splinters.includes(helper.teamSplinterToPlay(fireTeam).toLowerCase())) {
    //             console.log('PLAY fire: ', helper.teamSplinterToPlay(fireTeam), fireTeam)
    //             const summoner = card.makeCardId(fireTeam[0].toString());
    //             return [summoner, fireTeam];
    //         }
    //         //console.log('fire but deck not active')

    //     } catch (e) {
    //         console.log('fire DECK ERROR: ', e)
    //     }
    // }
    if (teamToPlay) {
        page.click('.btn--create-team')[0];
    } else {
        throw new Error('Team Selection error');
    }
    await page.waitFor(5000);
    try {
        await page.waitForXPath(`//div[@card_detail_id="${teamToPlay.summoner}"]`, { timeout: 3000 }).then(summonerButton => summonerButton.click());
        if (card.color(teamToPlay.cards[0]) === 'Gold') {
            console.log('Dragon play TEAMCOLOR', helper.teamActualSplinterToPlay(teamToPlay.cards))
            await page.waitForXPath(`//div[@data-original-title="${helper.teamActualSplinterToPlay(teamToPlay.cards)}"]`, { timeout: 8000 }).then(selector => selector.click())
        }
        await page.waitFor(5000);
        for (i = 1; i <= 6; i++) {
            console.log('play: ', teamToPlay.cards[i].toString())
            await teamToPlay.cards[i] ? page.waitForXPath(`//div[@card_detail_id="${teamToPlay.cards[i].toString()}"]`, { timeout: 10000 }).then(selector => selector.click()) : console.log('nocard ', i);
            await page.waitFor(1000);
        }

        await page.waitFor(5000);
        await page.click('.btn-green')[0]; //start fight
        await page.waitFor(240000);
        await browser.close();
    } catch (e) {
        console.log('Error in cards selection!', e);
        await browser.close();
        throw new Error(e);
    }


}

cron.schedule('*/14 * * * *', async () => {
    const browser = await puppeteer.launch({ headless: false });
    try {
        await startBotPlayMatch(browser);
        await browser.close();
    }
    catch (e) {
        console.log('END Error: ', e);
        await browser.close();
    }
});

// puppeteer.launch({ headless: false })
//     .then(async browser => startBotPlayMatch(browser)
//         .then(() => browser.close())
//         .catch((e) => console.log('Error: ', e))
//     )

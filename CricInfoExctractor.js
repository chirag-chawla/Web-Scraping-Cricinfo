//npm install minimist
//npm install axios
//npm install excel4node

//node CricInfoExctractor.js --dataFolder="data" --excel="WorldCup.csv" --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" 
let minimist=require("minimist");
let axios=require("axios");
let fs=require("fs");
let excel4node=require("excel4node");
let pdf=require("pdf-lib");
let jsdom=require("JSDOM");
let path=require("path");
const { rgb } = require("pdf-lib");

//download using axios
//
//read using jsdom
//make excel using excel4node
//make pdf using pdf-lib

let args=minimist(process.argv);

let dnldPromise=axios.get(args.url);
dnldPromise.then(function(response){
    let html=response.data;

    let dom=new jsdom.JSDOM(html);
    let document=dom.window.document;

    let matches=[];
    let matchScoreDivs=document.querySelectorAll("div.match-score-block");
    console.log(matchScoreDivs.length);
    for(let i=0;i<matchScoreDivs.length;i++){
    let match={};

    let nameParas=matchScoreDivs[i].querySelectorAll("p.name");
    match.t1=nameParas[0].textContent;
    //console.log(match.t1);
    match.t2=nameParas[1].textContent;

    let scores=matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
    //console.log(i+"\t"+scores.length);
    if(scores.length==2){
        match.t1s=scores[0].textContent;
        match.t2s=scores[1].textContent;
    }else if(scores.length==1){
        match.t1s=scores[0].textContent;
        match.t2s=""
    }else {
        match.t1s="";
        match.t2s="";
    }

   let result = matchScoreDivs[i].querySelector("div.status-text > span")
   match.result=result.textContent;
   //console.log(match);
   matches.push(match);
    }
    //console.log(matches);
    let matchesJSON=JSON.stringify(matches);
    fs.writeFileSync("matches.json",matchesJSON,"utf-8");

    let teams=[];
    for(let i=0;i<matches.length;i++){
        putTeamInTeamsArrayIfMissing(teams,matches[i])
    }
    //console.log(teams);

    for(let i=0;i<matches.length;i++){
        putMatchInAppropriateTeam(teams,matches[i])
    }
    //console.log(teams);
     let teamsJSON=JSON.stringify(teams);
     //console.log(teamsJSON);
     fs.writeFileSync("teams.json",teamsJSON,"utf-8");

     createExcelFile(teams);
     createFolders(teams);

}).catch(function(err){
    console.log("Error occured!");
    console.log(err);
})

function createFolders(teams){
    fs.mkdirSync(args.dataFolder);
    for(let i=0;i<teams.length;i++){
        let teamFN=path.join(args.dataFolder,teams[i].name);
        fs.mkdirSync(teamFN);

        for(let j=0;j<teams[i].matches.length;j++){
            let matchFileName=path.join(teamFN,teams[i].matches[j].vs+".pdf");
            createScoreCard(teams[i].name,teams[i].matches[j],matchFileName);
        }
    }
}
function createScoreCard(teamName,match,matchFileName){
    let t1=teamName;
    let t1str=JSON.stringify(t1);
    let t2=match.vs;
    let t1s=match.selfScore;
    let t2s=match.oppScore;
    let result=match.result;

    let bytesOfPdfTemplate=fs.readFileSync("Template.pdf");
    let pdfDocPromise=pdf.PDFDocument.load(bytesOfPdfTemplate);
    pdfDocPromise.then(function(pdfdoc){
        let page=pdfdoc.getPage(0);

        page.drawText(t1str.toUpperCase(),{
            x: 200,
            y: 820,
            size: 25,
            color:rgb(0,0.53,0.71),
            
        });
        page.drawText(t2,{
            x: 320,
            y: 705,
            size: 10
        });
        page.drawText(t1s,{
            x: 320,
            y: 691,
            size: 10
        });
        page.drawText(t2s,{
            x: 320,
            y: 677,
            size: 10
        });
        page.drawText(result,{
            x: 320,
            y: 662,
            size: 10
        });

        let finalpdfDocPromise=pdfdoc.save();
        finalpdfDocPromise.then(function(finalPdfBytes){
            fs.writeFileSync(matchFileName,finalPdfBytes);
        })

    })
}
function putTeamInTeamsArrayIfMissing(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }

    if (t1idx == -1) {
        teams.push({
            name: match.t1,
            matches: []
        });
    }

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }

    if (t2idx == -1) {
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}

function putMatchInAppropriateTeam(teams,match){
    let t1idx=-1;
    for(let i=0;i<teams.length;i++){
        if(teams[i].name==match.t1)
        {
            t1idx=i;
            break;
        }
    }
    let team1=teams[t1idx];
    team1.matches.push({
        vs: match.t2,
        selfScore: match.t1s, 
        oppScore: match.t2s,
        result: match.result
    });

    let t2idx=-1;
    for(let i=0;i<teams.length;i++){
        if(teams[i].name==match.t2){
            t2idx=i;
            break;
        }
    }
    let team2=teams[t2idx];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.t2s, 
        oppScore: match.t1s,
        result: match.result
    })
}

function createExcelFile(teams){
    let wb=new excel4node.Workbook();

    for(let i=0;i<teams.length;i++){
        let sheet=wb.addWorksheet(teams[i].name);

        sheet.cell(1,1).string("vs");
        sheet.cell(1,2).string("Self Score");
        sheet.cell(1,3).string("Opp Score");
        sheet.cell(1,4).string("Result");

        for(let j=0;j<teams[i].matches.length;j++){
            sheet.cell(2+j,1).string(teams[i].matches[j].vs);
            sheet.cell(2+j,2).string(teams[i].matches[j].selfScore);
            sheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
            sheet.cell(2+j,4).string(teams[i].matches[j].result);
        }
    }

    

    wb.write(args.excel);
}
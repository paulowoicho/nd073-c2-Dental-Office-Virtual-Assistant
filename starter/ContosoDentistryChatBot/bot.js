// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration) 
      
        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);


        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.QnAMaker.getAnswers(context);
          
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
                     
            // determine which service to respond with based on the results from LUIS //
            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                LuisResult.intents.GetAvailability.score > .85
            ) {
                const dentistAvailabilityResponse = await this.dentistScheduler.getAvailability();
                await context.sendActivity(dentistAvailabilityResponse);
                await next();
                return;
            }

            else if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .6 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.time
            ) {
                const time = LuisResult.entities.$instance.time[0].text;
                const scheduleAppointmentResponse = await this.dentistScheduler.scheduleAppointment(time);

                await context.sendActivity(scheduleAppointmentResponse);
                await next();
                return;
            }
            
            else if (qnaResults[0]) {
                await context.sendActivity(`${qnaResults[0].answer}`);
            }

            else {
                await context.sendActivity("Could you say that differently? I had trouble understanding it.");
            }
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = `Hello! I am the Contoso Dentistry Virtual Assistant! 
                            Try asking me for available appointment slots, or book an appointment! 
                            I can also answer some of your questions `;

        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;

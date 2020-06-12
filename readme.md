
# Welcome to MenashMQ!

Easy to use RabbitMQ abstraction with auto-reconnect for JavaScript and TypeScript

![MenashMQ Logo](https://raw.githubusercontent.com/Randomize163/MenashMQ/master/other/menashmq-logo.png "MenashMQ logo")

# Examples

## Initialize once - use everywhere:
**index.js**

    const { menash } = require('menashmq');
    
    await menash.connect('amqp://localhost');
    await menash.declareQueue('my-queue', { durable:  true });
    
**manager.js**

	const { menash } = require('menashmq');
	
	await  menash.send('my-queue', "I'm using MenashMQ");

## Declare your topology easily in one place:

    const { menash } = require('menashmq');
    
	await menash.declareTopology({
		exchanges: [
			{ name: 'first-exchange', type: 'fanout', options: { durable:  false } },
			{ name: 'second-exchange', type: 'direct' },
			{ name: 'third-exchange', type: 'topic' },
		],
		queues: [
			{ name:  'queue1', options: { durable:  false } },
			{ name:  'queue2' },
			{ name:  'queue3' },
			{ name:  'queue4' },
		],
		bindings: [
			{ source: 'first-exchange', destination: 'queue1' },
			{ source: 'second-exchange', destination: 'queue2' },
			{ source: 'third-exchange', destination: 'queue3', pattern: "*.menash" },
			{ source: 'third-exchange', destination: 'queue4', pattern: "monkey.#" },
		]
	});
  
## TypeScript support

MenashMQ is written in Typescript and supports it perfectly!

**index.ts**

    import menash from 'menashmq';
    
	await menash.connect('amqp://localhost');
	await menash.declateQueue('menash-queue');
	
**produce.ts**

    import menash from 'menashmq';
    
    await menash.send('menash-queue', { name: 'menash', type: 'monkey' });
    
**consume.ts**

    import menash, { ConsumerMessage } from 'menashmq';
    
    await menash.queues['menash-queue'].activateConsumer((msg: ConsumerMessage) => {
		const  animal = msg.getContent() as  IAnimal;
		console.log('Name:', animal.name);
		console.log('Type:', animal.type);

		msg.ack();
	}, { noAck: false });

## Upcoming features:

- add consumers as part of declareTopology()

- delayed nack() for class ConsumerMessage msg.nack(ms = 0)

- automatic dead letter retry configuration

- consume(queueName, func, parameters) and stopConsume(queueName)

- support RPC with message.reply()

# API

 
## Client

**Methods:**

- connect()

- close()

- bind()

- declareQueue()

- deleteQueue()

- declareExchange()

- deleteExchange()

- declareTopology()

- send()

- queues['queueName']

- exchanges['exchangeName']

  

**Events:**

- close

- error

- ready

## Exchange

**Methods:**

- bind()

- delete()

- send()

  

## Queue

**Methods:**

- activateConsumer()

- stopConsumer()

- bind()

- delete()

- prefetch()

- send()

  

## ConsumerMessage

**Methods:**

- setContent()

- getContent()

- getRawContent()

- ack()

- nack()

- reject()
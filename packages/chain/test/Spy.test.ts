import {log} from "@proto-kit/common";
import {describe, expect} from "@jest/globals";
import {TestingAppChain} from "@proto-kit/sdk";
import {Spy, SpyMessage} from "../src/Spy";
import {Field, PrivateKey, PublicKey} from "o1js";
import {TransactionExecutionResult} from "@proto-kit/sequencer";
import {Balances} from "@proto-kit/library";

log.setLevel('ERROR')

describe('Spy', () => {
    it('Check spy work', async () => {
        const appChain = TestingAppChain.fromRuntime({Balances, Spy});

        appChain.configurePartial({
            Runtime: {
                Balances: {},
                Spy: {},
            }
        })

        await appChain.start();
        const spy = appChain.runtime.resolve('Spy')

        const sendMsg = async (
            sendFrom: PrivateKey,
            msgId: Field,
            msg: SpyMessage
        ): Promise<TransactionExecutionResult> => {
            const sender = sendFrom.toPublicKey()

            appChain.setSigner(sendFrom)
            let tx = await appChain.transaction(sender, () => {
                spy.sendMessage(msgId, msg);
            })

            await tx.sign()
            await tx.send()
            return (await appChain.produceBlock())!.transactions[0]
        }

        interface testSpy {
            id: Field,
            privateKey: PrivateKey,
            publicKey: PublicKey | undefined,
            securityKey: Field,
        }

        const testSpy1: testSpy = {
            id: Field.from(1),
            privateKey: PrivateKey.random(),
            publicKey: undefined,
            securityKey: Field.from(12)
        }

        testSpy1.publicKey = testSpy1.privateKey.toPublicKey()


        const testSpy2: testSpy = {
            id: Field.from(2),
            privateKey: PrivateKey.random(),
            publicKey: undefined,
            securityKey: Field.from(24)
        }

        testSpy2.publicKey = testSpy2.privateKey.toPublicKey()

        const testSpy3: testSpy = {
            id: Field.from(3),
            privateKey: PrivateKey.random(),
            publicKey: undefined,
            securityKey: Field.from(55)
        }

        testSpy3.publicKey = testSpy3.privateKey.toPublicKey()

        const testSpy4: testSpy = {
            id: Field.from(4),
            privateKey: PrivateKey.random(),
            publicKey: undefined,
            securityKey: Field.from(1212)
        }

        testSpy4.publicKey = testSpy4.privateKey.toPublicKey()


        appChain.setSigner(testSpy1.privateKey)
        let tx = await appChain.transaction(testSpy1.publicKey, () => {
            testSpy1.securityKey && spy.addSpy(testSpy1.id, testSpy1.securityKey)
        })

        await tx.sign()
        await tx.send()
        await appChain.produceBlock()

        tx = await appChain.transaction(testSpy1.publicKey, () => {
            testSpy2.securityKey && spy.addSpy(testSpy2.id, testSpy2.securityKey)
        })

        await tx.sign();
        await tx.send();
        await appChain.produceBlock();

        tx = await appChain.transaction(testSpy1.publicKey, () => {
            testSpy3.securityKey && spy.addSpy(testSpy3.id, testSpy3.securityKey)
        })

        await tx.sign();
        await tx.send();
        await appChain.produceBlock();

        tx = await appChain.transaction(testSpy1.publicKey, () => {
            testSpy4.securityKey && spy.addSpy(testSpy4.id, testSpy4.securityKey)
        })

        await tx.sign();
        await tx.send();
        await appChain.produceBlock();


        // True msg
        const trueMsg = SpyMessage.randomize(testSpy1.id, testSpy1.securityKey)
        let result = await sendMsg(testSpy1.privateKey, Field(1), trueMsg)
        expect(result.status.toBoolean()).toBeTruthy()

        // True msg from 3
        const trueMsg2 = SpyMessage.randomize(testSpy3.id, testSpy3.securityKey)
        result = await sendMsg(testSpy3.privateKey, Field(1), trueMsg2)
        expect(result.status.toBoolean()).toBeTruthy()

        // Wrong msg id
        result = await sendMsg(testSpy2.privateKey, Field(1), trueMsg)
        expect(result.status.toBoolean()).toBeFalsy()

        // Wrong securityKey
        const falseMsg = SpyMessage.randomize(testSpy3.id, testSpy2.securityKey)
        result = await sendMsg(testSpy1.privateKey, Field(1), falseMsg)
        expect(result.status.toBoolean()).toBeFalsy()

        // Wrong length of securityKey
        const falseMsg2 = SpyMessage.randomize(testSpy4.id, testSpy4.securityKey)
        result = await sendMsg(testSpy4.privateKey, Field(1), falseMsg2)
        expect(result.status.toBoolean()).toBeFalsy()

        // No message
        const falseMsg3 = SpyMessage.randomize(Field(4), Field(5))
        result = await sendMsg(PrivateKey.random(), Field(1), falseMsg3)
        expect(result.status.toBoolean()).toBeFalsy()

        const spyStatus1 =
            await appChain.query.runtime.Spy.spyStatus.get(testSpy1.id);
        const spyStatus2 =
            await appChain.query.runtime.Spy.spyStatus.get(testSpy2.id);
        const spyStatus3 =
            await appChain.query.runtime.Spy.spyStatus.get(testSpy3.id);
        const spyStatus4 =
            await appChain.query.runtime.Spy.spyStatus.get(testSpy4.id);

        expect(spyStatus1?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus2?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus3?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus4?.lastMsgId.equals(Field.from(1))).toBeTruthy();
    }, 1_000_000);
})
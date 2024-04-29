import { TestingAppChain } from '@proto-kit/sdk';
import { Field, PrivateKey, PublicKey } from 'o1js';
import { log } from '@proto-kit/common';
import {
    MessageProof,
    SpyExtended,
    SpyMessage,
    SpyMessageProofPublicInput,
    proveZkMessage,
} from '../src/Spy';
import { TransactionExecutionResult } from '@proto-kit/sequencer';
import { Pickles } from 'o1js/dist/node/snarky';
import { dummyBase64Proof } from 'o1js/dist/node/lib/proof_system';
import {Balances} from "@proto-kit/library";

log.setLevel('ERROR')

export async function mockProof<I, O, P>(
    publicOutput: O,
    ProofType: new ({
      proof,
      publicInput,
      publicOutput,
      maxProofsVerified,
                    }: {
        proof: unknown;
        publicInput: I;
        publicOutput: any;
        maxProofsVerified: 0 | 2 | 1;
    }) => P,
    publicInput: I
): Promise<P> {
    const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
    return new ProofType({
        proof: proof,
        maxProofsVerified: 2,
        publicInput,
        publicOutput,
    });
}

describe('Spy', () => {
    it('Check spy work', async () => {
        const appChain = TestingAppChain.fromRuntime({Balances, SpyExtended});

        appChain.configurePartial({
            Runtime: {
                Balances: {},
                SpyExtended: {},
            }
        })

        await appChain.start();
        const spy = appChain.runtime.resolve('SpyExtended')

        const sendMsg = async (
            sendFrom: PrivateKey,
            msgId: Field,
            msg: SpyMessage
        ): Promise<TransactionExecutionResult> => {
            const sender = sendFrom.toPublicKey()

            const publicInput = new SpyMessageProofPublicInput({
                securityKey: msg.securityKey,
            });

            const publicOutput = proveZkMessage(publicInput, msg);
            const proof = await mockProof(publicOutput, MessageProof, publicInput);

            appChain.setSigner(sendFrom)
            let tx = await appChain.transaction(sender, () => {
                spy.sendMessage(msg.agentID, msgId, proof);
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
            securityKey: Field.from(999)
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
        await expect(sendMsg(testSpy4.privateKey, Field(1), falseMsg2)).rejects.toThrow()

        // No message
        const falseMsg3 = SpyMessage.randomize(testSpy3.id, Field.from(76))
        result = await sendMsg(PrivateKey.random(), Field(1), falseMsg3)
        expect(result.status.toBoolean()).toBeFalsy()

        const spyStatus1 =
            await appChain.query.runtime.SpyExtended.spyStatus.get(testSpy1.id);
        const spyStatus2 =
            await appChain.query.runtime.SpyExtended.spyStatus.get(testSpy2.id);
        const spyStatus3 =
            await appChain.query.runtime.SpyExtended.spyStatus.get(testSpy3.id);
        const spyStatus4 =
            await appChain.query.runtime.SpyExtended.spyStatus.get(testSpy4.id);

        expect(spyStatus1?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus2?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus3?.lastMsgId.equals(Field.from(1))).toBeTruthy();
        expect(spyStatus4?.lastMsgId.equals(Field.from(1))).toBeTruthy();

        const spy1AdditionalInfo =
            await appChain.query.runtime.SpyExtended.additionalInfo.get(
                testSpy1.id
            );

        console.log('SPY1:')
        console.log('blockHeight:', spy1AdditionalInfo?.blockHeight.toString())
        console.log('senderNonce:', spy1AdditionalInfo?.senderNonce.toString())
        console.log('sender:', spy1AdditionalInfo?.sender.toString())

    }, 1_000_000);
})
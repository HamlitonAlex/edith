import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, runAgentTurn } from "../agent/index.js";
import { createModelContext } from "../agent/model-gateway.js";
import { createKnownAgentState } from "./known-agent-fixture.js";

const at = (minute = 0, day = "2026-09-15") => new Date(`${day}T10:${String(minute).padStart(2, "0")}:00Z`);

function proposal() {
  return runAgentTurn(createKnownAgentState(at()), "帮我判断下一步", at());
}

function start(text = "接受，现在学 Python 的 for 循环", minute = 1) {
  const proposed = proposal();
  return runAgentTurn(proposed.state, text, at(minute));
}

test("accepting a knowledge step enters Tutor Mode with a baseline check", () => {
  const result = start();
  assert.equal(result.kind, "tutor");
  assert.equal(result.state.tutor_session.mode, "tutor");
  assert.equal(result.state.tutor_session.domain, "computer");
  assert.match(result.state.tutor_session.topic, /for|循环/i);
  assert.equal(result.state.tutor_session.stage, "baseline");
  assert.match(result.reply, /知道|理解|基础|会到哪一步/);
});

test("English and general-knowledge steps retain their learning domain", () => {
  const cLanguage = start("接受，学 C 语言指针基础", 2);
  assert.equal(cLanguage.state.tutor_session.domain, "computer");
  assert.match(cLanguage.state.tutor_session.topic, /C 语言/);

  const english = start("接受，练习英语表达：介绍我的项目", 3);
  assert.equal(english.state.tutor_session.domain, "english");
  assert.match(english.state.tutor_session.topic, /英语|项目|表达/);

  const general = start("接受，讨论量子纠缠到底是什么", 4);
  assert.equal(general.state.tutor_session.domain, "general_knowledge");
  assert.match(general.state.tutor_session.topic, /量子纠缠/);
});

test("a weak baseline gets one small example instead of a lecture", () => {
  const started = start();
  const result = runAgentTurn(started.state, "我只知道 for 是重复，其他不会", at(4));
  assert.equal(result.kind, "tutor");
  assert.equal(result.state.tutor_session.stage, "scaffold");
  assert.match(result.reply, /例子|一步|最小|先试/);
  assert.doesNotMatch(result.reply, /完整答案|直接给你代码/);
});

test("a learner who can read but cannot write receives a tiny scaffold", () => {
  const started = start();
  const result = runAgentTurn(started.state, "例子我能看懂，但自己写不出来", at(5));
  assert.equal(result.state.tutor_session.stage, "practice");
  assert.equal(result.state.tutor_session.error_causes.at(-1), "knows_but_cannot_write");
  assert.match(result.reply, /骨架|填空|先写|一小步/);
  assert.doesNotMatch(result.reply, /for i in range\(3\).*print\(i\)/);
});

test("a direct request for the answer is met with a hint first", () => {
  const started = start();
  const result = runAgentTurn(started.state, "别问了，直接告诉我答案", at(6));
  assert.equal(result.kind, "tutor");
  assert.equal(result.state.tutor_session.stage, "hint");
  assert.equal(result.state.tutor_session.hints_used, 1);
  assert.match(result.reply, /提示|先试|思路/);
  assert.doesNotMatch(result.reply, /标准答案|完整代码/);
});

test("repeated confusion changes the explanation and lowers the step", () => {
  let result = start();
  result = runAgentTurn(result.state, "还是没懂", at(7));
  result = runAgentTurn(result.state, "我还是不明白", at(8));
  result = runAgentTurn(result.state, "真的卡住了", at(9));
  assert.equal(result.kind, "tutor");
  assert.ok(result.state.tutor_session.adaptations >= 2);
  assert.equal(result.state.tutor_session.difficulty, "lower");
  assert.match(result.reply, /生活|类比|最小|只看一个/);
});

test("a follow-up question is answered with an example and a restatement check", () => {
  const started = start();
  const result = runAgentTurn(started.state, "为什么 range(3) 不包含 3？", at(10));
  assert.equal(result.kind, "tutor");
  assert.match(result.reply, /0.*1.*2|不包含|到不了/);
  assert.match(result.reply, /你来|换句话说|复述|理解/);
});

test("misconceptions are recorded as a concept error, not just wrong", () => {
  const started = start();
  const result = runAgentTurn(started.state, "我以为 range(3) 会一直到 3", at(11));
  assert.equal(result.state.tutor_session.error_causes.at(-1), "concept_misunderstood");
  assert.match(result.reply, /边界|不包含|例子/);
});

test("syntax and ordering mistakes are distinguished", () => {
  const syntax = start();
  const syntaxResult = runAgentTurn(syntax.state, "for i in range(3) print(i)", at(12));
  assert.equal(syntaxResult.state.tutor_session.error_causes.at(-1), "syntax");

  const ordering = start("接受，学 MySQL 查询的执行顺序", 13);
  const orderingResult = runAgentTurn(ordering.state, "我先取结果再判断条件，所以顺序总是错", at(14));
  assert.equal(orderingResult.state.tutor_session.error_causes.at(-1), "step_order");
});

test("fast understanding moves to transfer instead of repeating the baseline", () => {
  const started = start();
  const result = runAgentTurn(
    started.state,
    "for 循环会重复执行，range(3) 产生 0、1、2，我能解释为什么不含 3",
    at(15),
  );
  assert.equal(result.kind, "tutor");
  assert.equal(result.state.tutor_session.stage, "transfer");
  assert.equal(result.state.tutor_session.difficulty, "higher");
  assert.match(result.reply, /新场景|迁移|自己写|变式/);
});

test("English correction is gentle and asks the learner to try again", () => {
  const started = start("接受，练习英语表达：介绍我的项目", 16);
  const result = runAgentTurn(started.state, "He go to school yesterday", at(17));
  assert.equal(result.state.tutor_session.domain, "english");
  assert.equal(result.state.tutor_session.error_causes.at(-1), "expression");
  assert.match(result.reply, /went|过去|再说一次|你来/);
  assert.doesNotMatch(result.reply, /你错了|太差/);
});

test("general-knowledge misconceptions are corrected without shaming", () => {
  const started = start("接受，讨论量子纠缠是什么", 18);
  const result = runAgentTurn(started.state, "量子纠缠就是可以超光速传消息", at(19));
  assert.equal(result.state.tutor_session.domain, "general_knowledge");
  assert.equal(result.state.tutor_session.error_causes.at(-1), "concept_misunderstood");
  assert.match(result.reply, /不能用来传递|相关性|换句话说/);
  assert.doesNotMatch(result.reply, /你错了|胡说/);
});

test("mastery requires explanation or transfer evidence, not merely saying finished", () => {
  const started = start();
  const notYet = runAgentTurn(started.state, "我学完了", at(20));
  assert.equal(notYet.verified, false);
  assert.equal(notYet.state.learning_results.length, 0);

  const result = runAgentTurn(
    notYet.state,
    "我能解释：range(3) 只给 0、1、2，因为右边界不包含；如果要打印 0 到 2，我会写 for i in range(3)，并能说出输出。",
    at(21),
  );
  assert.equal(result.verified, true);
  assert.equal(result.state.tutor_session, null);
  assert.equal(result.state.learning_results.length, 1);
  assert.equal(result.state.recent_learning.length, 1);
});

test("a verified session emits the full structured learning result and memory feedback", () => {
  const started = start();
  const result = runAgentTurn(
    started.state,
    "具体场景是写一个列表；我掌握了 range 的右边界规则，能独立解释并写出自己的循环；还要巩固嵌套循环。",
    at(22),
  );
  const learning = result.learning_result;
  assert.ok(learning);
  for (const key of ["learned", "mastered", "partial", "unmastered", "common_errors", "next_suggestion", "verification"]) {
    assert.ok(Object.hasOwn(learning, key), `missing ${key}`);
  }
  assert.match(learning.learned, /range|循环/);
  assert.ok(learning.mastered.length >= 1);
  assert.ok(learning.partial.length >= 1);
  assert.ok(learning.next_suggestion);
  assert.equal(result.state.memory.at(-1).kind, "learning_result");
  assert.equal(result.state.memory.at(-1).status, "recorded");
  assert.equal(result.state.recent_learning.at(-1).result_id, learning.id);
});

test("learning result feeds the next planner through skill evidence", () => {
  const started = start();
  const result = runAgentTurn(
    started.state,
    "我理解这个概念，能独立写一个新例子并解释每一步为什么这样做。具体场景是统计列表中的偶数，最小行动是自己完成一次。",
    at(23),
  );
  assert.equal(result.verified, true);
  assert.ok(Object.values(result.state.skills).some(skill => skill.evidence.length > 0));
  assert.equal(createModelContext(result.state, "下一步").learning_results.at(-1).id, result.learning_result.id);
  assert.match(result.reply, /掌握|下一次|重新判断/);
});

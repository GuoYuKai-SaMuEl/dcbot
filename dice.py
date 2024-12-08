import random
def dice(bound:list[int]=[1,6],amount:int=1,default:str=None,cons:list[list[str]]=None):
    result=[random.randint(bound[0],bound[1])for _ in range(amount)]
    s=sum(result)
    if default==None:
        return result,f"總和為 {s}"
    for con in cons:
        try:
            if '?' in con[0]:
                ans=eval(con[0].replace('?','s'))
            else:
                ans=eval(str(s)+con[0])
            if ans:
                return result,con[1]
        except Exception as exc:
            print('dice error(',con,'):',exc)
    return result,default
if __name__=='__main__':
    print(dice())
    print(dice([1,6],3,[['===9','A'],['%2==1','B'],['5<=?<=7','D']],'C'))
    result=dice([1,4],3)
    print(','.join(list(map(str,result[0]))))